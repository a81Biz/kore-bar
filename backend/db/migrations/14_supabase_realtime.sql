-- ============================================================
-- Migration 14: Supabase Realtime
--
-- Habilita Realtime en las tablas que los frontends escuchan:
--   - order_items   (KDS kitchen + waiter READY notifications)
--   - order_headers (cashier board updates)
--   - waiter_calls  (waiter call notifications)
--
-- REPLICA IDENTITY FULL incluye todos los campos en el payload
-- de UPDATE/DELETE (necesario para filtros de estado).
--
-- La publicación supabase_realtime solo existe en Supabase;
-- el bloque DO falla silenciosamente en Docker local.
-- ============================================================

ALTER TABLE order_items   REPLICA IDENTITY FULL;
ALTER TABLE order_headers REPLICA IDENTITY FULL;
ALTER TABLE waiter_calls  REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime
        ADD TABLE order_items, order_headers, waiter_calls;
EXCEPTION WHEN OTHERS THEN
    NULL; -- No estamos en Supabase (Docker local) — ignorar
END $$;
