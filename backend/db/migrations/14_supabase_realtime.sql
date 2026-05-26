-- ============================================================
-- Migration 14: Supabase Realtime — REPLICA IDENTITY + publication
--
-- REPLICA IDENTITY FULL: incluye todos los campos en el payload
-- de UPDATE/DELETE (necesario para filtros por columnas de estado).
--
-- El bloque DO verifica primero que la publicación supabase_realtime
-- exista (solo en Supabase) y agrega cada tabla solo si no está ya.
-- En Docker local no hay publicación → RAISE NOTICE y continúa.
-- ============================================================

ALTER TABLE order_items   REPLICA IDENTITY FULL;
ALTER TABLE order_headers REPLICA IDENTITY FULL;
ALTER TABLE waiter_calls  REPLICA IDENTITY FULL;

-- Función de diagnóstico: devuelve el estado de la publicación supabase_realtime.
-- Accesible por el anon key vía /rest/v1/rpc/kore_realtime_status
CREATE OR REPLACE FUNCTION kore_realtime_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pub_exists boolean;
    result     jsonb;
BEGIN
    SELECT EXISTS(SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    INTO pub_exists;

    IF NOT pub_exists THEN
        RETURN jsonb_build_object('publication_exists', false, 'tables', '{}'::jsonb);
    END IF;

    SELECT jsonb_build_object(
        'publication_exists', true,
        'tables', jsonb_object_agg(
            t.name,
            EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname    = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename  = t.name
            )
        )
    )
    FROM (VALUES ('order_items'), ('order_headers'), ('waiter_calls')) AS t(name)
    INTO result;

    RETURN result;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION kore_realtime_status() TO anon';
    END IF;
END $$;

DO $$
DECLARE
    t         text;
    tables    text[] := ARRAY['order_items', 'order_headers', 'waiter_calls'];
    pub_exists boolean;
    in_pub     boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) INTO pub_exists;

    IF NOT pub_exists THEN
        RAISE NOTICE '[Migration 14] Publicación supabase_realtime no existe (entorno local) — omitiendo ALTER PUBLICATION';
        RETURN;
    END IF;

    FOREACH t IN ARRAY tables LOOP
        SELECT EXISTS(
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = t
        ) INTO in_pub;

        IF NOT in_pub THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
            RAISE NOTICE '[Migration 14] Tabla % añadida a supabase_realtime', t;
        ELSE
            RAISE NOTICE '[Migration 14] Tabla % ya estaba en supabase_realtime — ok', t;
        END IF;
    END LOOP;
END $$;
