-- ============================================================
-- sp_menu.sql
-- Procedimientos almacenados del módulo de Menú y Recetario
-- Dependencias: 04_menu.sql, 03_inventory.sql
-- ============================================================

-- ── CATEGORÍAS ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_create_menu_category(
    p_code VARCHAR, p_name VARCHAR, p_description TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO menu_categories (code, name, description)
    VALUES (p_code, p_name, p_description);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_update_menu_category(
    p_code VARCHAR, p_name VARCHAR, p_description TEXT, p_is_active BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    UPDATE menu_categories
    SET name = p_name, description = p_description,
        is_active = p_is_active, updated_at = CURRENT_TIMESTAMP
    WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_delete_menu_category_smart(p_code VARCHAR)
RETURNS VOID AS $$
DECLARE
    v_active_dishes INT;
    v_has_history   BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_active_dishes
    FROM menu_dishes
    WHERE category_id = (SELECT id FROM menu_categories WHERE code = p_code)
      AND is_active = true;

    IF v_active_dishes > 0 THEN
        RAISE EXCEPTION 'La categoría tiene platillos activos' USING ERRCODE = 'P0001';
    END IF;

    SELECT (CURRENT_TIMESTAMP - created_at) > interval '1 hour'
    INTO v_has_history
    FROM menu_categories WHERE code = p_code;

    IF v_has_history THEN
        UPDATE menu_categories SET is_active = false WHERE code = p_code;
    ELSE
        DELETE FROM menu_categories WHERE code = p_code;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ── PLATILLOS ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_create_menu_dish(
    p_code           VARCHAR,
    p_category_code  VARCHAR,
    p_name           VARCHAR,
    p_description    TEXT,
    p_price          DECIMAL,
    p_image_url      VARCHAR
)
RETURNS VOID AS $$
DECLARE v_cat_id UUID;
BEGIN
    SELECT id INTO v_cat_id FROM menu_categories WHERE code = p_category_code;
    IF v_cat_id IS NULL THEN
        RAISE EXCEPTION 'Categoría % no existe', p_category_code USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO menu_dishes (code, category_id, name, description, price, image_url)
    VALUES (p_code, v_cat_id, p_name, p_description, p_price, p_image_url);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_update_menu_dish(
    p_code          VARCHAR,
    p_category_code VARCHAR,
    p_name          VARCHAR,
    p_description   TEXT,
    p_price         DECIMAL,
    p_image_url     VARCHAR,
    p_is_active     BOOLEAN
)
RETURNS VOID AS $$
DECLARE v_cat_id UUID;
BEGIN
    SELECT id INTO v_cat_id FROM menu_categories WHERE code = p_category_code;
    IF v_cat_id IS NULL THEN
        RAISE EXCEPTION 'Categoría % no existe', p_category_code USING ERRCODE = 'P0002';
    END IF;
    UPDATE menu_dishes
    SET category_id = v_cat_id, name = p_name, description = p_description,
        price = p_price, image_url = p_image_url, is_active = p_is_active,
        updated_at = CURRENT_TIMESTAMP
    WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_delete_menu_dish_smart(p_code VARCHAR)
RETURNS VOID AS $$
DECLARE v_has_history BOOLEAN;
BEGIN
    SELECT (CURRENT_TIMESTAMP - created_at) > interval '1 hour'
    INTO v_has_history
    FROM menu_dishes WHERE code = p_code;

    IF v_has_history THEN
        UPDATE menu_dishes SET is_active = false WHERE code = p_code;
    ELSE
        DELETE FROM menu_dishes WHERE code = p_code;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ── RECETARIO (BOM) ──────────────────────────────────────────

-- Alta de insumo en inventory_items (punto de entrada desde el módulo de cocina)
CREATE OR REPLACE FUNCTION sp_create_ingredient(
    p_code VARCHAR, p_name VARCHAR, p_unit VARCHAR
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO inventory_items (code, name, recipe_unit, unit_measure)
    VALUES (p_code, p_name, p_unit, p_unit)
    ON CONFLICT (code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Agrega o actualiza un ingrediente en la receta de un platillo
-- Si el platillo no tenía receta, activa has_recipe automáticamente
CREATE OR REPLACE FUNCTION sp_add_recipe_item(
    p_dish_code       VARCHAR,
    p_ingredient_code VARCHAR,
    p_quantity        DECIMAL
)
RETURNS VOID AS $$
DECLARE
    v_dish_id UUID;
    v_ing_id  UUID;
BEGIN
    SELECT id INTO v_dish_id FROM menu_dishes WHERE code = p_dish_code;
    SELECT id INTO v_ing_id  FROM inventory_items WHERE code = p_ingredient_code;

    IF v_dish_id IS NULL OR v_ing_id IS NULL THEN
        RAISE EXCEPTION 'Platillo o ingrediente no encontrado' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO dish_recipes (dish_id, item_id, quantity_required)
    VALUES (v_dish_id, v_ing_id, p_quantity)
    ON CONFLICT (dish_id, item_id)
    DO UPDATE SET quantity_required = EXCLUDED.quantity_required;

    UPDATE menu_dishes SET has_recipe = TRUE WHERE id = v_dish_id;
END;
$$ LANGUAGE plpgsql;
