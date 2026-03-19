-- ============================================================
-- sp_auth.sql
-- Funciones de autenticación del sistema
-- Dependencias: 01_hr.sql (employees, system_users, roles, areas)
--
-- CONVENCIÓN: Las operaciones de auth son lecturas/verificaciones
-- atómicas → usan prefijo fn_ (FUNCTION), no sp_ (PROCEDURE).
-- ============================================================

-- ── VALIDAR CREDENCIALES (admin web: employee_number + password) ──
-- Devuelve los datos de sesión si las credenciales son correctas.
-- El hash bcrypt vive en system_users.password_hash.
-- La comparación real de bcrypt se hace en Node con bcrypt.compare();
-- esta función solo devuelve el hash + datos de rol para que el
-- helper pueda comparar sin hacer una segunda query.

CREATE OR REPLACE FUNCTION fn_get_user_for_login(p_employee_number VARCHAR)
RETURNS TABLE(
    "employeeNumber"  VARCHAR,
    "firstName"       VARCHAR,
    "lastName"        VARCHAR,
    "passwordHash"    VARCHAR,
    "roleCode"        VARCHAR,
    "roleName"        VARCHAR,
    "areaCode"        VARCHAR,
    "areaName"        VARCHAR,
    "isActive"        BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.employee_number   AS "employeeNumber",
        e.first_name        AS "firstName",
        e.last_name         AS "lastName",
        su.password_hash    AS "passwordHash",
        r.code              AS "roleCode",
        r.name              AS "roleName",
        a.code              AS "areaCode",
        a.name              AS "areaName",
        e.is_active         AS "isActive"
    FROM system_users su
    JOIN employees e    ON e.employee_number = su.employee_number
    JOIN roles r        ON r.id = su.role_id
    JOIN positions pos  ON pos.id = e.position_id
    JOIN areas a        ON a.id = pos.area_id
    WHERE su.employee_number = p_employee_number
      AND su.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- ── VALIDAR PIN (POS: meseros / caja / cocina) ────────────────────
-- Devuelve los datos de sesión si el PIN es correcto.
-- El pin_code se guarda en employees como VARCHAR (puede ser hash
-- o texto simple según la configuración del negocio).
-- La función devuelve is_pin_valid para que el helper decida.

CREATE OR REPLACE FUNCTION fn_get_user_for_pin(
    p_employee_number VARCHAR,
    p_pin_code        VARCHAR
)
RETURNS TABLE(
    "employeeNumber"  VARCHAR,
    "firstName"       VARCHAR,
    "lastName"        VARCHAR,
    "isPinValid"      BOOLEAN,
    "roleCode"        VARCHAR,
    "roleName"        VARCHAR,
    "areaCode"        VARCHAR,
    "areaName"        VARCHAR,
    "canAccessCashier" BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.employee_number       AS "employeeNumber",
        e.first_name            AS "firstName",
        e.last_name             AS "lastName",
        (e.pin_code = p_pin_code) AS "isPinValid",
        r.code                  AS "roleCode",
        r.name                  AS "roleName",
        a.code                  AS "areaCode",
        a.name                  AS "areaName",
        a.can_access_cashier    AS "canAccessCashier"
    FROM employees e
    JOIN positions pos   ON pos.id = e.position_id
    JOIN areas a         ON a.id = pos.area_id
    LEFT JOIN system_users su ON su.employee_number = e.employee_number
    LEFT JOIN roles r    ON r.id = su.role_id
    WHERE e.employee_number = p_employee_number
      AND e.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- ── VERIFICAR ÁREA DE UN TOKEN (middleware area:XXX) ──────────────
-- Devuelve true si el empleado pertenece al área requerida.
-- Usado en buildAuthMiddleware para el tipo 'area:CAJA', etc.

CREATE OR REPLACE FUNCTION fn_employee_has_area(
    p_employee_number VARCHAR,
    p_area_code       VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE v_result BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM employees e
        JOIN positions pos ON pos.id = e.position_id
        JOIN areas a       ON a.id = pos.area_id
        WHERE e.employee_number = p_employee_number
          AND a.code = p_area_code
          AND e.is_active = true
    ) INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
