-- ============================================================
-- 07_operations.sql
-- Módulo de Operaciones (Llamadas a Mesero, etc.)
-- Dependencias: 02_restaurant.sql
-- Tablas: waiter_calls
-- ============================================================

CREATE TABLE waiter_calls (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id   UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    reason     VARCHAR(50) NOT NULL DEFAULT 'ASSISTANCE',
    status     VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'ATTENDED', 'DISMISSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Triggers updated_at ──────────────────────────────────────
CREATE TRIGGER update_waiter_calls_modtime
    BEFORE UPDATE ON waiter_calls
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();


-- Canal Realtime 
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realtime_read_waiter_calls"
  ON waiter_calls FOR SELECT
  USING (true);