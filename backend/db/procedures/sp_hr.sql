-- ============================================================
-- sp_hr.sql
-- Procedimientos almacenados del módulo de RRHH
-- Dependencias: 01_hr.sql
-- ============================================================

-- Sincroniza (upsert) Área + Puesto y los vincula en Positions
CREATE OR REPLACE PROCEDURE sp_upsert_hr_catalog(
    p_area_code  VARCHAR,
    p_area_name  VARCHAR,
    p_job_code   VARCHAR,
    p_job_name   VARCHAR
)
LANGUAGE plpgsql AS $$
DECLARE
    v_area_id      UUID;
    v_job_title_id UUID;
    v_pos_code     VARCHAR;
BEGIN
    INSERT INTO areas (code, name)
    VALUES (p_area_code, p_area_name)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    RETURNING id INTO v_area_id;

    INSERT INTO job_titles (code, name)
    VALUES (p_job_code, p_job_name)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    RETURNING id INTO v_job_title_id;

    v_pos_code := p_area_code || '-' || p_job_code;

    INSERT INTO positions (code, area_id, job_title_id)
    VALUES (v_pos_code, v_area_id, v_job_title_id)
    ON CONFLICT (code) DO NOTHING;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_upsert_employee(
    p_employee_number VARCHAR,
    p_first_name      VARCHAR  DEFAULT NULL,
    p_last_name       VARCHAR  DEFAULT NULL,
    p_area_code       VARCHAR  DEFAULT NULL,
    p_job_code        VARCHAR  DEFAULT NULL,
    p_hire_date       DATE     DEFAULT NULL,
    p_is_active       BOOLEAN  DEFAULT NULL,
    p_pin_code        VARCHAR  DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_position_id UUID;
BEGIN
    IF p_area_code IS NOT NULL AND p_job_code IS NOT NULL THEN
        SELECT id INTO v_position_id
        FROM positions
        WHERE code = p_area_code || '-' || p_job_code;

        IF v_position_id IS NULL THEN
            RAISE EXCEPTION 'Posición no encontrada para Área % y Puesto %', p_area_code, p_job_code;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM employees WHERE employee_number = p_employee_number) THEN
        UPDATE employees SET
            first_name  = COALESCE(p_first_name,  first_name),
            last_name   = COALESCE(p_last_name,   last_name),
            position_id = COALESCE(v_position_id, position_id),
            hire_date   = COALESCE(p_hire_date,   hire_date),
            is_active   = COALESCE(p_is_active,   is_active),
            pin_code    = COALESCE(p_pin_code,    pin_code),
            updated_at  = NOW()
        WHERE employee_number = p_employee_number;
    ELSE
        IF p_first_name IS NULL OR p_last_name IS NULL THEN
            RAISE EXCEPTION 'first_name y last_name son requeridos para crear un empleado';
        END IF;

        INSERT INTO employees (employee_number, first_name, last_name, hire_date, position_id, pin_code, is_active)
        VALUES (
            p_employee_number,
            p_first_name,
            p_last_name,
            p_hire_date,
            v_position_id,
            p_pin_code,
            COALESCE(p_is_active, TRUE)
        );
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_deactivate_employee(p_employee_number VARCHAR)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE system_users SET is_active = false, updated_at = NOW()
    WHERE employee_number = p_employee_number;

    UPDATE employees SET is_active = false, updated_at = NOW()
    WHERE employee_number = p_employee_number;
END;
$$;

CREATE OR REPLACE FUNCTION fn_check_employee_exists(p_employee_number VARCHAR)
RETURNS TABLE("id" UUID, "hireDate" DATE, "isActive" BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.hire_date AS "hireDate", e.is_active AS "isActive"
    FROM employees e
    WHERE e.employee_number = p_employee_number
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- ── CATÁLOGOS DE ÁREAS ────────────────────────────────────────
-- Reemplaza las mutaciones SQL raw que vivían en admin-employee.model.js

CREATE OR REPLACE PROCEDURE sp_create_area(
    p_code               VARCHAR,
    p_name               VARCHAR,
    p_can_access_cashier BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO areas (code, name, can_access_cashier)
    VALUES (p_code, p_name, p_can_access_cashier)
    ON CONFLICT (code) DO UPDATE
    SET name               = EXCLUDED.name,
        can_access_cashier = EXCLUDED.can_access_cashier,
        is_active          = TRUE,
        updated_at         = NOW();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_area(
    p_code               VARCHAR,
    p_name               VARCHAR,
    p_can_access_cashier BOOLEAN DEFAULT NULL  -- NULL = no cambiar el valor actual
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE areas
    SET name               = p_name,
        can_access_cashier = COALESCE(p_can_access_cashier, can_access_cashier),
        updated_at         = NOW()
    WHERE code = p_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Área no encontrada: %', p_code USING ERRCODE = 'P0002';
    END IF;
END;
$$;


-- ── CATÁLOGOS DE PUESTOS ──────────────────────────────────────
-- Reemplaza las mutaciones SQL raw que vivían en admin-employee.model.js

CREATE OR REPLACE PROCEDURE sp_create_job_title(p_code VARCHAR, p_name VARCHAR)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO job_titles (code, name)
    VALUES (p_code, p_name)
    ON CONFLICT (code) DO UPDATE
    SET name       = EXCLUDED.name,
        is_active  = TRUE,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_job_title(p_code VARCHAR, p_name VARCHAR)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE job_titles SET name = p_name, updated_at = NOW() WHERE code = p_code;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_deactivate_job_title(p_code VARCHAR)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE job_titles SET is_active = FALSE, updated_at = NOW() WHERE code = p_code;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_bulk_deactivate_job_titles(p_codes VARCHAR[])
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE job_titles SET is_active = FALSE, updated_at = NOW()
    WHERE code = ANY(p_codes);
END;
$$;

CREATE OR REPLACE FUNCTION sp_get_attendance(
    p_date           DATE    DEFAULT NULL,
    p_start_date     DATE    DEFAULT NULL,
    p_end_date       DATE    DEFAULT NULL,
    p_employee_number VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    "assignmentId"   UUID,
    "employeeNumber" VARCHAR,
    "firstName"      VARCHAR,
    "lastName"       VARCHAR,
    "shift"          VARCHAR,
    "shiftName"      VARCHAR,
    "startTime"      TIME,
    "endTime"        TIME,
    "assignmentDate" DATE,
    "zoneName"       VARCHAR,
    "zoneCode"       VARCHAR,
    "attendanceId"   UUID,
    "checkInAt"      TIMESTAMP WITH TIME ZONE,
    "source"         VARCHAR,
    "attendanceStatus" TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT  m.assignment_id,
            m.employee_number,
            m.first_name,
            m.last_name,
            m.shift,
            m.shift_name,
            m.start_time,
            m.end_time,
            m.assignment_date,
            m.zone_name,
            m.zone_code,
            m.attendance_id,
            m.check_in_at,
            m.source,
            m.attendance_status::TEXT
    FROM (
        SELECT  v1.assignment_id,
                v1.employee_number,
                v1.first_name,
                v1.last_name,
                v1.shift,
                v1.shift_name,
                v1.start_time,
                v1.end_time,
                v1.assignment_date,
                v1.zone_name,
                v1.zone_code,
                v1.attendance_id,
                v1.check_in_at,
                v1.source,
                v1.attendance_status
        FROM    vw_attendance_monitor v1

        UNION ALL

        SELECT  v2.assignment_id,
                v2.employee_number,
                v2.first_name,
                v2.last_name,
                v2.shift,
                v2.shift_name,
                v2.start_time,
                v2.end_time,
                v2.assignment_date,
                v2.zone_name,
                v2.zone_code,
                v2.attendance_id,
                v2.check_in_at,
                v2.source,
                v2.attendance_status
        FROM    vw_schedule_monitor v2
    ) AS m
    WHERE (
        (p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND m.assignment_date >= p_start_date AND m.assignment_date <= p_end_date)
        OR
        ((p_start_date IS NULL OR p_end_date IS NULL) AND p_date IS NOT NULL AND m.assignment_date = p_date)
    )
    AND (p_employee_number IS NULL OR m.employee_number = p_employee_number)
    ORDER BY m.assignment_date DESC, m.shift, m.last_name ASC;
END;
$$;
