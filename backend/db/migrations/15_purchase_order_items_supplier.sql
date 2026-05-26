-- ============================================================
-- Migration 15: Agregar supplier_id a purchase_order_items
--
-- La tabla fue creada en producción antes de que se añadiera
-- la columna supplier_id al schema de 10_faltantes.sql.
-- ADD COLUMN IF NOT EXISTS es idempotente.
-- ============================================================

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
        CHECK (origin IN ('KITCHEN', 'ADMIN', 'MANUAL'));

COMMENT ON COLUMN purchase_order_items.supplier_id IS
    'Proveedor específico de esta línea (puede diferir del proveedor del pedido).';

COMMENT ON COLUMN purchase_order_items.origin IS
    'Origen de la línea: KITCHEN (automático), ADMIN (manual desde panel), MANUAL (libre).';
