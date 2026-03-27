-- ============================================================
-- 12_auth_pin_hash.sql
-- Migración: Seguridad de PINs con bcrypt
--
-- CAMBIOS:
-- 1. fn_get_user_for_pin: ya NO compara en plain text,
--    ahora devuelve el hash para que Node haga bcrypt.compare()
-- 2. Script de migración para hashear PINs existentes en texto plano
--    (se ejecuta desde Node, no desde SQL puro, porque bcrypt
--    no existe nativo en PostgreSQL)
-- ============================================================

-- ── REEMPLAZAR fn_get_user_for_pin ────────────────────────────
-- Antes: (e.pin_code = p_pin_code) AS "isPinValid"  ← INSEGURO
-- Ahora: devuelve pin_hash para que el helper compare con bcrypt

DROP FUNCTION IF EXISTS fn_get_user_for_pin(VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION fn_get_user_for_pin(p_employee_number VARCHAR)
RETURNS TABLE(
    "employeeNumber"   VARCHAR,
    "firstName"        VARCHAR,
    "lastName"         VARCHAR,
    "pinHash"          VARCHAR,
    "roleCode"         VARCHAR,
    "roleName"         VARCHAR,
    "areaCode"         VARCHAR,
    "areaName"         VARCHAR,
    "canAccessCashier" BOOLEAN,
    "isActive"         BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.employee_number       AS "employeeNumber",
        e.first_name            AS "firstName",
        e.last_name             AS "lastName",
        e.pin_code              AS "pinHash",
        r.code                  AS "roleCode",
        r.name                  AS "roleName",
        a.code                  AS "areaCode",
        a.name                  AS "areaName",
        a.can_access_cashier    AS "canAccessCashier",
        e.is_active             AS "isActive"
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
