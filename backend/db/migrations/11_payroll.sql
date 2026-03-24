-- ── 1. Ampliar el CHECK de source ────────────────────────────
-- Agrega 'ADMIN' como fuente válida para check-ins manuales.
-- Primero eliminar la constraint existente, luego recrearla.
ALTER TABLE attendance_records
    DROP CONSTRAINT IF EXISTS attendance_records_source_check;

ALTER TABLE attendance_records
    ADD CONSTRAINT attendance_records_source_check
        CHECK (source IN ('WAITERS', 'CASHIER', 'KITCHEN', 'ADMIN'));


-- ── 2. TABLA: payroll_deductions ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_deductions (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(50)   NOT NULL,
    deduction_date  DATE          NOT NULL,
    deduction_type  VARCHAR(30)   NOT NULL
        CHECK (deduction_type IN (
            'FALTA_INJUSTIFICADA',
            'RETARDO',
            'PERMISO_SIN_GOCE',
            'DIA_ECONOMICO',
            'SUSPENSION',
            'SANCION'
        )),
    motivo          TEXT          NOT NULL,
    applied_by      VARCHAR(50)   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payroll_deduction_emp_date
        UNIQUE (employee_number, deduction_date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_ded_emp
    ON public.payroll_deductions (employee_number, deduction_date);


-- ── 3. SP: sp_create_payroll_deduction ───────────────────────
CREATE OR REPLACE PROCEDURE sp_create_payroll_deduction(
    p_employee_number VARCHAR,
    p_deduction_date  DATE,
    p_deduction_type  VARCHAR,
    p_motivo          TEXT,
    p_applied_by      VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM employees
        WHERE employee_number = p_employee_number AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Empleado no encontrado o inactivo: %', p_employee_number
            USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO payroll_deductions (
        employee_number, deduction_date, deduction_type, motivo, applied_by
    ) VALUES (
        p_employee_number, p_deduction_date, p_deduction_type, p_motivo, p_applied_by
    )
    ON CONFLICT (employee_number, deduction_date)
    DO UPDATE SET
        deduction_type = EXCLUDED.deduction_type,
        motivo         = EXCLUDED.motivo,
        applied_by     = EXCLUDED.applied_by,
        created_at     = NOW();
END;
$$;


-- ── 4. SP: sp_delete_payroll_deduction ───────────────────────
CREATE OR REPLACE PROCEDURE sp_delete_payroll_deduction(p_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM payroll_deductions WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Descuento no encontrado: %', p_id USING ERRCODE = 'P0002';
    END IF;
END;
$$;


-- ── 5. SP: sp_record_admin_checkin ───────────────────────────
-- FIX: ya no usa assignment_id (no existe en attendance_records).
-- Verifica que el empleado tenga asignación hoy en alguna fuente,
-- luego inserta via attendance_records (employee_number, work_date).
-- Idempotente por la UNIQUE (employee_number, work_date).
CREATE OR REPLACE PROCEDURE sp_record_admin_checkin(
    p_employee_number VARCHAR
)
LANGUAGE plpgsql AS $$
DECLARE
    v_has_assignment BOOLEAN := FALSE;
BEGIN
    -- Verificar asignación en restaurant_assignments (meseros de Piso)
    SELECT EXISTS (
        SELECT 1 FROM restaurant_assignments
        WHERE employee_number = p_employee_number
          AND assignment_date = CURRENT_DATE
    ) INTO v_has_assignment;

    -- Si no está en Piso, verificar en employee_schedules (staff)
    IF NOT v_has_assignment THEN
        SELECT EXISTS (
            SELECT 1 FROM employee_schedules
            WHERE employee_number = p_employee_number
              AND schedule_date = CURRENT_DATE
        ) INTO v_has_assignment;
    END IF;

    IF NOT v_has_assignment THEN
        RAISE EXCEPTION 'No hay asignación activa hoy para: %', p_employee_number
            USING ERRCODE = 'P0001';
    END IF;

    -- Insertar check-in con source ADMIN (idempotente)
    INSERT INTO attendance_records (employee_number, source, work_date)
    VALUES (p_employee_number, 'ADMIN', CURRENT_DATE)
    ON CONFLICT (employee_number, work_date) DO NOTHING;
END;
$$;


-- ── 6. VISTA: vw_payroll_history ─────────────────────────────
-- FIX: une attendance_records por (employee_number, work_date)
-- en lugar de assignment_id (columna inexistente).
-- Fuente Piso usa ra.assignment_date = ar.work_date
-- Fuente Schedule usa es.schedule_date = ar.work_date
CREATE OR REPLACE VIEW public.vw_payroll_history AS

-- Fuente 1: Meseros de Piso (restaurant_assignments)
SELECT
    e.employee_number,
    e.first_name,
    e.last_name,
    a.code              AS area_code,
    a.name              AS area_name,
    jt.code             AS job_title_code,
    jt.name             AS job_title_name,
    ra.assignment_date  AS work_date,
    sc.name             AS shift_name,
    sc.start_time,
    sc.end_time,
    ar.check_in_at,
    ar.source           AS checkin_source,
    (ar.id IS NOT NULL)                             AS worked_day,
    (pd.id IS NOT NULL)                             AS has_deduction,
    pd.id               AS deduction_id,
    pd.deduction_type,
    pd.motivo,
    pd.applied_by,
    CASE
        WHEN ar.id IS NULL                              THEN FALSE
        WHEN pd.deduction_type IN (
            'FALTA_INJUSTIFICADA','PERMISO_SIN_GOCE','SUSPENSION'
        )                                               THEN FALSE
        ELSE TRUE
    END                 AS pay_day,
    'PISO'              AS roster_source
FROM  restaurant_assignments ra
JOIN  employees e     ON e.employee_number = ra.employee_number
JOIN  positions pos   ON pos.id            = e.position_id
JOIN  areas a         ON a.id              = pos.area_id
JOIN  job_titles jt   ON jt.id             = pos.job_title_id
LEFT JOIN shift_catalog sc
      ON  sc.code = ra.shift
LEFT JOIN attendance_records ar
      ON  ar.employee_number = ra.employee_number
      AND ar.work_date       = ra.assignment_date   -- ← FIX: sin assignment_id
LEFT JOIN payroll_deductions pd
      ON  pd.employee_number = ra.employee_number
      AND pd.deduction_date  = ra.assignment_date

UNION ALL

-- Fuente 2: Staff no-piso (employee_schedules)
SELECT
    e.employee_number,
    e.first_name,
    e.last_name,
    a.code              AS area_code,
    a.name              AS area_name,
    jt.code             AS job_title_code,
    jt.name             AS job_title_name,
    es.schedule_date    AS work_date,
    sc.name             AS shift_name,
    sc.start_time,
    sc.end_time,
    ar.check_in_at,
    ar.source           AS checkin_source,
    (ar.id IS NOT NULL)                             AS worked_day,
    (pd.id IS NOT NULL)                             AS has_deduction,
    pd.id               AS deduction_id,
    pd.deduction_type,
    pd.motivo,
    pd.applied_by,
    CASE
        WHEN ar.id IS NULL                              THEN FALSE
        WHEN pd.deduction_type IN (
            'FALTA_INJUSTIFICADA','PERMISO_SIN_GOCE','SUSPENSION'
        )                                               THEN FALSE
        ELSE TRUE
    END                 AS pay_day,
    'SCHEDULE'          AS roster_source
FROM  employee_schedules es
JOIN  employees e     ON e.employee_number = es.employee_number
JOIN  positions pos   ON pos.id            = e.position_id
JOIN  areas a         ON a.id              = pos.area_id
JOIN  job_titles jt   ON jt.id             = pos.job_title_id
LEFT JOIN shift_catalog sc
      ON  sc.code = es.shift_code
LEFT JOIN attendance_records ar
      ON  ar.employee_number = es.employee_number
      AND ar.work_date       = es.schedule_date   -- ← FIX: sin assignment_id
LEFT JOIN payroll_deductions pd
      ON  pd.employee_number = es.employee_number
      AND pd.deduction_date  = es.schedule_date;