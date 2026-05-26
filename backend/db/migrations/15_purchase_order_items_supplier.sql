-- ============================================================
-- Migration 15: Columnas faltantes en purchase_order_items
--
-- La tabla fue creada en producción con un schema anterior que
-- no incluía supplier_id, origin ni qty_delivered.
-- ADD COLUMN IF NOT EXISTS es idempotente en cada re-ejecución.
-- ============================================================

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
        CHECK (origin IN ('KITCHEN', 'ADMIN', 'MANUAL'));

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS qty_delivered DECIMAL(12,4) NOT NULL DEFAULT 0
        CHECK (qty_delivered >= 0);

COMMENT ON COLUMN purchase_order_items.supplier_id IS
    'Proveedor específico de esta línea (puede diferir del proveedor del pedido).';

COMMENT ON COLUMN purchase_order_items.origin IS
    'Origen de la línea: KITCHEN (automático), ADMIN (manual desde panel), MANUAL (libre).';

COMMENT ON COLUMN purchase_order_items.qty_delivered IS
    'Cantidad recibida al sincronizar la entrega del pedido.';
