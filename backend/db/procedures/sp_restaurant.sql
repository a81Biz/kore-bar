-- ============================================================
-- sp_restaurant.sql
-- Procedimientos almacenados del módulo de Layout
-- Dependencias: 02_restaurant.sql
--
-- MIGRACIÓN: Todos los objetos eran FUNCTION RETURNS VOID.
-- Convertidos a PROCEDURE para cumplir la convención sp_* de mutaciones.
-- Los DROP FUNCTION eliminan las versiones antiguas antes de crear las nuevas.
-- ============================================================

-- ── Eliminar versiones FUNCTION obsoletas ─────────────────────
DROP FUNCTION IF EXISTS sp_create_zone(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS sp_update_zone(VARCHAR, VARCHAR, BOOLEAN);
DROP FUNCTION IF EXISTS sp_delete_zone_smart(VARCHAR);
DROP FUNCTION IF EXISTS sp_create_table(VARCHAR, VARCHAR, INT);
DROP FUNCTION IF EXISTS sp_update_table(VARCHAR, VARCHAR, INT, BOOLEAN);
DROP FUNCTION IF EXISTS sp_delete_table_smart(VARCHAR);
DROP FUNCTION IF EXISTS sp_create_assignment(VARCHAR, VARCHAR, VARCHAR, DATE);
DROP FUNCTION IF EXISTS sp_create_assignment_range(VARCHAR, VARCHAR, VARCHAR, DATE, DATE);


-- ── ZONAS ─────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_zone(p_code VARCHAR, p_name VARCHAR)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO restaurant_zones (code, name) VALUES (p_code, p_name);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_zone(p_code VARCHAR, p_name VARCHAR, p_is_active BOOLEAN)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE restaurant_zones
    SET name = p_name, is_active = p_is_active, updated_at = CURRENT_TIMESTAMP
    WHERE code = p_code;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_zone_smart(p_zone_code VARCHAR)
LANGUAGE plpgsql AS $$
DECLARE
    v_active_tables INT;
    v_has_history   BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_active_tables
    FROM restaurant_tables t
    JOIN restaurant_zones z ON t.zone_id = z.id
    WHERE z.code = p_zone_code AND t.is_active = true;

    IF v_active_tables > 0 THEN
        RAISE EXCEPTION 'La zona tiene mesas activas' USING ERRCODE = 'P0001';
    END IF;

    SELECT (CURRENT_TIMESTAMP - created_at) > interval '1 hour'
    INTO v_has_history
    FROM restaurant_zones WHERE code = p_zone_code;

    IF v_has_history THEN
        UPDATE restaurant_zones SET is_active = false WHERE code = p_zone_code;
    ELSE
        DELETE FROM restaurant_zones WHERE code = p_zone_code;
    END IF;
END;
$$;


-- ── MESAS ──────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_table(
    p_table_code VARCHAR, p_zone_code VARCHAR, p_capacity INT
)
LANGUAGE plpgsql AS $$
DECLARE v_zone_id UUID;
BEGIN
    SELECT id INTO v_zone_id FROM restaurant_zones WHERE code = p_zone_code;
    IF v_zone_id IS NULL THEN
        RAISE EXCEPTION 'La zona % no existe', p_zone_code USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO restaurant_tables (code, zone_id, capacity)
    VALUES (p_table_code, v_zone_id, p_capacity);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_table(
    p_table_code VARCHAR, p_zone_code VARCHAR, p_capacity INT, p_is_active BOOLEAN
)
LANGUAGE plpgsql AS $$
DECLARE v_zone_id UUID;
BEGIN
    SELECT id INTO v_zone_id FROM restaurant_zones WHERE code = p_zone_code;
    IF v_zone_id IS NULL THEN
        RAISE EXCEPTION 'La zona % no existe', p_zone_code USING ERRCODE = 'P0002';
    END IF;
    UPDATE restaurant_tables
    SET zone_id = v_zone_id, capacity = p_capacity,
        is_active = p_is_active, updated_at = CURRENT_TIMESTAMP
    WHERE code = p_table_code;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_table_smart(p_table_id VARCHAR)
LANGUAGE plpgsql AS $$
DECLARE v_has_history BOOLEAN;
BEGIN
    SELECT (CURRENT_TIMESTAMP - created_at) > interval '1 hour'
    INTO v_has_history
    FROM restaurant_tables WHERE code = p_table_id;

    IF v_has_history THEN
        UPDATE restaurant_tables SET is_active = false WHERE code = p_table_id;
    ELSE
        DELETE FROM restaurant_tables WHERE code = p_table_id;
    END IF;
END;
$$;


-- ── ASIGNACIONES ──────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_assignment(
    p_emp   VARCHAR,
    p_zone  VARCHAR,
    p_shift VARCHAR,
    p_date  DATE
)
LANGUAGE plpgsql AS $$
DECLARE v_zone_id UUID;
BEGIN
    SELECT id INTO v_zone_id FROM restaurant_zones WHERE code = p_zone;
    IF v_zone_id IS NULL THEN
        RAISE EXCEPTION 'Zona % no existe', p_zone USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
    VALUES (p_emp, v_zone_id, p_shift, p_date);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_create_assignment_range(
    p_emp        VARCHAR,
    p_zone       VARCHAR,
    p_shift      VARCHAR,
    p_start_date DATE,
    p_end_date   DATE
)
LANGUAGE plpgsql AS $$
DECLARE
    v_zone_id   UUID;
    v_curr_date DATE := p_start_date;
BEGIN
    SELECT id INTO v_zone_id FROM restaurant_zones WHERE code = p_zone;
    IF v_zone_id IS NULL THEN
        RAISE EXCEPTION 'Zona % no existe', p_zone USING ERRCODE = 'P0002';
    END IF;

    WHILE v_curr_date <= p_end_date LOOP
        INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
        VALUES (p_emp, v_zone_id, p_shift, v_curr_date);
        v_curr_date := v_curr_date + 1;
    END LOOP;
END;
$$;

-- Reemplaza el DELETE raw que vivía en admin-floor.model.js
CREATE OR REPLACE PROCEDURE sp_delete_assignment(p_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM restaurant_assignments WHERE id = p_id;
END;
$$;
