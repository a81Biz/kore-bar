-- ============================================================
-- 03_inventory.sql
-- Módulo de Inventario Multi-Ubicación
-- Dependencias: 00_core.sql
-- Tablas: suppliers, inventory_items, supplier_prices,
--         inventory_locations, inventory_stock_locations,
--         inventory_kardex
--
-- NOTA ARQUITECTURAL:
--   inventory_items es la tabla maestra de insumos.
--   recipe_unit + conversion_factor implementan la conversión
--   KISS entre unidad de compra y unidad de receta.
--   Ejemplo: se compra una botella (1 L) → receta usa ml (conv=1000)
-- ============================================================

CREATE TABLE suppliers (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code         VARCHAR(50) UNIQUE NOT NULL,
    name         VARCHAR(150) NOT NULL,
    contact_info TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insumos maestros (ingredientes, productos directos, etc.)
CREATE TABLE inventory_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code              VARCHAR(50) UNIQUE NOT NULL,
    name              VARCHAR(150) NOT NULL,
    unit_measure      VARCHAR(20) NOT NULL,         -- Unidad de compra (Kg, L, Pz)
    recipe_unit       VARCHAR(50) DEFAULT 'Pz',     -- Unidad de receta (g, ml, Pz)
    conversion_factor DECIMAL(10, 4) NOT NULL DEFAULT 1.0000,
    current_stock     DECIMAL(10, 3) DEFAULT 0.000 CHECK (current_stock >= 0),
    minimum_stock     DECIMAL(10, 3) DEFAULT 0.000 CHECK (minimum_stock >= 0),
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Precios por proveedor
CREATE TABLE supplier_prices (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id    UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    item_id        UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    price          DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    lead_time_days INT DEFAULT 1 CHECK (lead_time_days >= 0),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, item_id)
);

-- Catálogo de ubicaciones físicas (bodegas, estaciones, piso)
CREATE TABLE inventory_locations (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'OPERATION'
             CHECK (type IN ('BODEGA', 'OPERATION'))
);

-- Stock actual por item × ubicación (tabla pivote)
CREATE TABLE inventory_stock_locations (
    item_id     UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    stock       DECIMAL(12, 4) NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, location_id)
);

-- Kardex de partida doble (libro mayor inmutable)
-- transaction_type: IN_PURCHASE, OUT_SALE, TRANSFER, ADJUSTMENT
-- from_location_id NULL  → entrada sin origen (compra)
-- to_location_id   NULL  → salida sin destino (venta/consumo)
-- Ambos iguales          → ajuste físico
CREATE TABLE inventory_kardex (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    from_location_id UUID REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    to_location_id   UUID REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL,
    quantity         DECIMAL(12, 4) NOT NULL,
    reference_id     VARCHAR(100),
    date             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Triggers updated_at ──────────────────────────────────────
CREATE TRIGGER update_suppliers_modtime
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_inventory_modtime
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
