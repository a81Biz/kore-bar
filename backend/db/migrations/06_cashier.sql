-- ============================================================
-- 06_cashier.sql
-- Módulo de Caja y Tickets
-- Dependencias: 05_orders.sql, 01_hr.sql
-- Tablas: payments, tickets
-- Sequences: ticket_folio_seq
--
-- Una orden puede tener múltiples payments (cobro mixto).
-- Un ticket es el folio único emitido al cerrar una orden.
-- ============================================================

-- Garantiza unicidad numérica del folio del día
CREATE SEQUENCE IF NOT EXISTS public.ticket_folio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Líneas de cobro (soporte cobro mixto efectivo + tarjeta, etc.)
CREATE TABLE payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES order_headers(id) ON DELETE RESTRICT,
    method      VARCHAR(20) NOT NULL
                    CHECK (method IN ('CASH', 'CARD', 'TRANSFER', 'OTHER')),
    amount      DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    tip         DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (tip >= 0),
    cashier_id  UUID REFERENCES employees(id) ON DELETE RESTRICT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Folio fiscal único por orden
CREATE TABLE tickets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio        VARCHAR(50) UNIQUE NOT NULL,
    order_id     UUID UNIQUE NOT NULL REFERENCES order_headers(id) ON DELETE RESTRICT,
    subtotal     DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax          DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tip_total    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total        DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_invoiced  BOOLEAN NOT NULL DEFAULT false,
    invoice_data JSONB NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_tickets_folio     ON tickets(folio);
CREATE INDEX idx_tickets_order_id  ON tickets(order_id);

-- ── Triggers updated_at ──────────────────────────────────────
CREATE TRIGGER update_tickets_modtime
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
