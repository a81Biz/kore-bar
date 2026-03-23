-- ============================================================
-- Migration v2: employee_schedules
-- Módulo de Horarios para cajeros, cocineros y staff no-piso
--
-- Problema: restaurant_assignments tiene zone_id NOT NULL,
-- por lo que cajeros y cocineros no pueden tener roster.
-- Esta tabla lo resuelve sin modificar la tabla existente.
--
-- Ejecutar en orden: tabla → índices → SPs → vista
-- ============================================================

-- ── 1. TABLA PRINCIPAL ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_schedules (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(20)  NOT NULL,
    shift_code      VARCHAR(20)  NOT NULL,
    schedule_date   DATE         NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_es_employee FOREIGN KEY (employee_number)
        REFERENCES employees(employee_number) ON DELETE CASCADE,

    CONSTRAINT fk_es_shift FOREIGN KEY (shift_code)
        REFERENCES shift_catalog(code),

    -- Un empleado solo puede tener un turno por día
    CONSTRAINT uq_es_emp_day UNIQUE (employee_number, schedule_date)
);

CREATE INDEX IF NOT EXISTS idx_es_schedule_date ON employee_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_es_employee_num  ON employee_schedules(employee_number);

COMMENT ON TABLE employee_schedules IS
    'Horarios de turnos para personal no-piso (cajeros, cocineros, etc.). '
    'No requiere zone_id a diferencia de restaurant_assignments (meseros).';

-- ── 2. SP: CREAR HORARIO CON RECURRENCIA ──────────────────────
-- Equivalente a sp_create_assignment_range pero sin zona.
-- Itera día por día en el rango; ON CONFLICT DO NOTHING = idempotente.
CREATE OR REPLACE PROCEDURE sp_create_employee_schedule(
    p_employee_number VARCHAR,
    p_shift_code      VARCHAR,
    p_start_date      DATE,
    p_end_date        DATE
)
LANGUAGE plpgsql AS $$
DECLARE
    v_current DATE := p_start_date;
BEGIN
    -- Guard: empleado debe existir y estar activo
    IF NOT EXISTS (
        SELECT 1 FROM employees
        WHERE employee_number = p_employee_number
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'El empleado % no existe o está inactivo.', p_employee_number
              USING ERRCODE = 'P0002';
    END IF;

    -- Guard: turno debe existir y estar activo
    IF NOT EXISTS (
        SELECT 1 FROM shift_catalog
        WHERE code = p_shift_code
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'El turno % no existe o está inactivo.', p_shift_code
              USING ERRCODE = 'P0002';
    END IF;

    -- Insertar un registro por cada día del rango
    WHILE v_current <= p_end_date LOOP
        INSERT INTO employee_schedules (employee_number, shift_code, schedule_date)
        VALUES (p_employee_number, p_shift_code, v_current)
        ON CONFLICT (employee_number, schedule_date) DO NOTHING;

        v_current := v_current + INTERVAL '1 day';
    END LOOP;
END;
$$;

-- ── 3. SP: ELIMINAR REGISTRO DE HORARIO ──────────────────────
CREATE OR REPLACE PROCEDURE sp_delete_employee_schedule(p_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM employee_schedules WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registro de horario no encontrado: %', p_id
              USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- ── 4. VISTA: MONITOR DE HORARIOS ────────────────────────────
-- Misma estructura de columnas que vw_attendance_monitor para que
-- el helper pueda UNION ambas fuentes con la misma interfaz.
-- zone_name / zone_code son NULL (personal no tiene zona asignada).
--
-- NOTA: Asume que attendance_records tiene las columnas:
--   id, employee_number, check_in_at (TIMESTAMPTZ), source
-- Ajustar si los nombres difieren en tu schema.
CREATE OR REPLACE VIEW vw_schedule_monitor AS
SELECT
    es.id                                        AS assignment_id,
    es.employee_number,
    e.first_name,
    e.last_name,
    es.shift_code                                AS shift,
    sc.name                                      AS shift_name,
    sc.start_time,
    sc.end_time,
    es.schedule_date                             AS assignment_date,
    NULL::VARCHAR                                AS zone_name,
    NULL::VARCHAR                                AS zone_code,
    ar.id                                        AS attendance_id,
    ar.check_in_at,
    ar.source,
    CASE
        WHEN ar.id IS NOT NULL               THEN 'PRESENTE'
        WHEN es.schedule_date < CURRENT_DATE THEN 'AUSENTE'
        ELSE                                      'ESPERADO'
    END                                          AS attendance_status
FROM employee_schedules es
JOIN employees     e  ON e.employee_number  = es.employee_number
JOIN shift_catalog sc ON sc.code            = es.shift_code
LEFT JOIN attendance_records ar
       ON ar.employee_number   = es.employee_number
      AND DATE(ar.check_in_at) = es.schedule_date;

