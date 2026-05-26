-- ============================================================
-- 00_core.sql
-- Extensions y funciones utilitarias compartidas
-- Debe ejecutarse PRIMERO antes de cualquier otro script
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función reutilizable para actualizar updated_at automáticamente
-- Es referenciada por triggers en TODOS los módulos
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Proxy de SQL para Cloudflare Workers ─────────────────────
-- El Worker no puede abrir conexiones TCP directas desde el edge,
-- por lo que envía SQL crudo a esta función vía Supabase RPC.
-- SECURITY DEFINER: corre con privilegios del owner, no del caller.
CREATE OR REPLACE FUNCTION kore_exec_sql(query_string TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    EXECUTE format(
        'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t',
        query_string
    ) INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'kore_exec_sql error: %', SQLERRM;
END;
$$;

-- Accesible desde el Worker con el anon key
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION kore_exec_sql(TEXT) TO anon';
    END IF;
END $$;
