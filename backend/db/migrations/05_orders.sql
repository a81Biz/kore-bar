-- ============================================================
-- 05_orders.sql
-- Módulo de Comandas (POS)
-- Dependencias: 02_restaurant.sql, 01_hr.sql, 04_menu.sql
-- Tablas: order_headers, order_items
--
-- Ciclo de vida de una orden:
--   OPEN → AWAITING_PAYMENT → CLOSED
--                           ↘ CANCELLED
--
-- Ciclo de vida de un item:
--   PENDING_KITCHEN → PREPARING → READY → COLLECTED → DELIVERED
--   PENDING_FLOOR                       → COLLECTED → DELIVERED
-- ============================================================

CREATE TABLE order_headers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(50) UNIQUE NOT NULL,
    table_id   UUID REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    waiter_id  UUID REFERENCES employees(id) ON DELETE RESTRICT,
    diners     INT NOT NULL DEFAULT 1,
    status     VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN', 'AWAITING_PAYMENT', 'CLOSED', 'CANCELLED')),
    total      DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES order_headers(id) ON DELETE CASCADE,
    dish_id    UUID NOT NULL REFERENCES menu_dishes(id) ON DELETE RESTRICT,
    quantity   INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    subtotal   DECIMAL(12, 2) NOT NULL,
    notes      TEXT,
    status     VARCHAR(20) NOT NULL DEFAULT 'PENDING_KITCHEN'
                   CHECK (status IN (
                       'PENDING_KITCHEN',
                       'PENDING_FLOOR',
                       'PREPARING',
                       'READY',
                       'COLLECTED',
                       'DELIVERED'
                   )),
    started_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX idx_order_headers_table_status ON order_headers(table_id, status);
CREATE INDEX idx_order_items_order_id       ON order_items(order_id);
CREATE INDEX idx_order_items_status         ON order_items(status);

-- ── Triggers updated_at ──────────────────────────────────────
CREATE TRIGGER update_order_headers_modtime
    BEFORE UPDATE ON order_headers
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
