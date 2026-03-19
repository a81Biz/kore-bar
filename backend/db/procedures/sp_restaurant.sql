-- ============================================================
-- sp_restaurant.sql
-- Procedimientos almacenados del módulo de Layout
-- Dependencias: 02_restaurant.sql
-- ============================================================

-- ── ZONAS ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_create_zone(p_code VARCHAR, p_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    INSERT INTO restaurant_zones (code, name) VALUES (p_code, p_name);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_update_zone(p_code VARCHAR, p_name VARCHAR, p_is_active BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE restaurant_zones
    SET name = p_name, is_active = p_is_active, updated_at = CURRENT_TIMESTAMP
    WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

-- Baja híbrida: lógica si tiene historial, física si es reciente
CREATE OR REPLACE FUNCTION sp_delete_zone_smart(p_zone_code VARCHAR)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;

-- ── MESAS ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_create_table(
    p_table_code VARCHAR, p_zone_code VARCHAR, p_capacity INT
)
RETURNS VOID AS $$
DECLARE v_zone_id UUID;
BEGIN
    SELECT id INTO v_zone_id FROM restaurant_zones WHERE code = p_zone_code;
    IF v_zone_id IS NULL THEN
        RAISE EXCEPTION 'La zona % no existe', p_zone_code USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO restaurant_tables (code, zone_id, capacity)
    VALUES (p_table_code, v_zone_id, p_capacity);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_update_table(
    p_table_code VARCHAR, p_zone_code VARCHAR, p_capacity INT, p_is_active BOOLEAN
)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_delete_table_smart(p_table_id VARCHAR)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;

-- ── ASIGNACIONES ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_create_assignment(
    p_emp   VARCHAR,
    p_zone  VARCHAR,
    p_shift VARCHAR,
    p_date  DATE
)
RETURNS VOID AS $$
DECLARE v_zone_id UUID;
BEGIN
    SELECT id INTO v_zone_id FROM restaurant_zones WHERE code = p_zone;
    IF v_zone_id IS NULL THEN
        RAISE EXCEPTION 'Zona % no existe', p_zone USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
    VALUES (p_emp, v_zone_id, p_shift, p_date);
END;
$$ LANGUAGE plpgsql;

-- Asignación en rango de fechas — aborta todo si hay conflicto en cualquier día
CREATE OR REPLACE FUNCTION sp_create_assignment_range(
    p_emp        VARCHAR,
    p_zone       VARCHAR,
    p_shift      VARCHAR,
    p_start_date DATE,
    p_end_date   DATE
)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;
