-- ============================================================
-- 08_turnos_asistencia.sql
-- Módulo: Gestión de Turnos y Asistencia
-- Tablas: shift_catalog, attendance_records
-- SPs:    sp_create_shift, sp_record_attendance, sp_reset_employee_pin
-- Views:  vw_attendance_monitor
-- ============================================================

-- ── 1. CATÁLOGO DE TURNOS ─────────────────────────────────────
-- Define las plantillas de turno del restaurante con horarios.
-- La columna `code` es la Llave Natural usada por restaurant_assignments.
CREATE TABLE IF NOT EXISTS shift_catalog (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR     UNIQUE  NOT NULL,   -- 'MATUTINO', 'VESPERTINO'
    name        VARCHAR     NOT NULL,            -- 'Turno Matutino'
    start_time  TIME        NOT NULL,            -- '08:00:00'
    end_time    TIME        NOT NULL,            -- '16:00:00'
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seeds estándar del restaurante
INSERT INTO shift_catalog (code, name, start_time, end_time) VALUES
    ('MATUTINO',  'Turno Matutino',   '08:00', '16:00'),
    ('VESPERTINO','Turno Vespertino', '16:00', '00:00')
ON CONFLICT (code) DO NOTHING;

-- ── 2. REGISTRO DE ASISTENCIA ─────────────────────────────────
-- Checador automático. Un solo registro por empleado por día
-- (el UNIQUE garantiza idempotencia en el SP).
-- La columna `source` indica desde qué micrositio se registró.
CREATE TABLE IF NOT EXISTS attendance_records (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR     NOT NULL,
    check_in_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source          VARCHAR     NOT NULL CHECK (source IN ('WAITERS', 'CASHIER', 'KITCHEN')),
    work_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attendance_daily UNIQUE (employee_number, work_date)
);

-- FK soft: evitamos cascadas que rompan historial si se desactiva un empleado
CREATE INDEX IF NOT EXISTS idx_attendance_work_date      ON attendance_records (work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date  ON attendance_records (employee_number, work_date);

-- ── 3. SP: Crear Turno ────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_create_shift(
    p_code       VARCHAR,
    p_name       VARCHAR,
    p_start_time TIME,
    p_end_time   TIME
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO shift_catalog (code, name, start_time, end_time)
    VALUES (p_code, p_name, p_start_time, p_end_time);
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'El código de turno % ya existe', p_code;
END;
$$;

-- ── 4. SP: Registrar Asistencia (idempotente) ─────────────────
-- ON CONFLICT DO NOTHING garantiza que el segundo check-in del
-- mismo empleado en el mismo día no falla ni sobreescribe.
CREATE OR REPLACE PROCEDURE sp_record_attendance(
    p_employee_number VARCHAR,
    p_source          VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO attendance_records (employee_number, source, work_date)
    VALUES (p_employee_number, p_source, CURRENT_DATE)
    ON CONFLICT (employee_number, work_date) DO NOTHING;
END;
$$;

-- ── 5. SP: Reset de PIN ───────────────────────────────────────
-- Solo el Gerente autenticado llama este SP (el SchemaRouter
-- ya valida la sesión antes de llegar aquí).
CREATE OR REPLACE PROCEDURE sp_reset_employee_pin(
    p_employee_number VARCHAR,
    p_new_pin         VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE employees
    SET    pin_code   = p_new_pin,
           updated_at = CURRENT_TIMESTAMP
    WHERE  employee_number = p_employee_number
      AND  is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empleado % no encontrado o inactivo', p_employee_number
            USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- ── 6. VISTA: Monitor de Asistencia ──────────────────────────
-- Cruza restaurant_assignments (el Roster) con attendance_records
-- (el Checador) para dar el estado real de cada empleado asignado.
-- Si no existe asistencia, el status es ESPERADO (hoy) o AUSENTE (pasado).
CREATE OR REPLACE VIEW vw_attendance_monitor AS
SELECT
    ra.id                                    AS assignment_id,
    ra.employee_number,
    e.first_name,
    e.last_name,
    ra.shift,
    ra.assignment_date,
    rz.name                                  AS zone_name,
    rz.code                                  AS zone_code,
    sc.name                                  AS shift_name,
    sc.start_time,
    sc.end_time,
    ar.id                                    AS attendance_id,
    ar.check_in_at,
    ar.source,
    CASE
        WHEN ar.id IS NOT NULL                    THEN 'PRESENTE'
        WHEN ra.assignment_date < CURRENT_DATE    THEN 'AUSENTE'
        ELSE                                           'ESPERADO'
    END                                      AS attendance_status
FROM  restaurant_assignments ra
JOIN  employees e
        ON  e.employee_number = ra.employee_number
JOIN  restaurant_zones rz
        ON  rz.id = ra.zone_id
LEFT JOIN shift_catalog sc
        ON  sc.code = ra.shift
LEFT JOIN attendance_records ar
        ON  ar.employee_number = ra.employee_number
        AND ar.work_date       = ra.assignment_date
ORDER BY ra.assignment_date DESC, ra.shift, e.last_name;