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
