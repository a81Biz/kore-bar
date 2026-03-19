-- ============================================================
-- 04_menu.sql
-- Módulo de Menú y Recetario (BOM)
-- Dependencias: 03_inventory.sql
-- Tablas: menu_categories, menu_dishes, dish_recipes
--
-- NOTA: dish_recipes es la única tabla de BOM.
--   La tabla legacy dish_ingredients (que apuntaba a
--   kitchen_ingredients) fue eliminada en la unificación
--   del módulo de inventario (2026-03-10).
-- ============================================================

CREATE TABLE menu_categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_dishes (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code               VARCHAR(50) UNIQUE NOT NULL,
    category_id        UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name               VARCHAR(150) NOT NULL,
    description        TEXT,
    price              DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    image_url          TEXT,
    is_active          BOOLEAN DEFAULT TRUE,
    has_recipe         BOOLEAN DEFAULT FALSE,
    preparation_method TEXT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bill of Materials: ingredientes por platillo
-- quantity_required está en recipe_unit del inventory_item
CREATE TABLE dish_recipes (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dish_id           UUID NOT NULL REFERENCES menu_dishes(id) ON DELETE CASCADE,
    item_id           UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_required DECIMAL(10, 3) NOT NULL CHECK (quantity_required > 0),
    UNIQUE(dish_id, item_id)
);

-- ── Triggers updated_at ──────────────────────────────────────
CREATE TRIGGER update_menu_cat_modtime
    BEFORE UPDATE ON menu_categories
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_menu_dishes_modtime
    BEFORE UPDATE ON menu_dishes
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
