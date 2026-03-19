-- ============================================================
-- 02_restaurant.sql
-- Módulo de Layout del Restaurante
-- Dependencias: 01_hr.sql
-- Tablas: restaurant_zones, restaurant_tables,
--         restaurant_assignments
-- ============================================================

CREATE TABLE restaurant_zones (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code       VARCHAR(50) UNIQUE NOT NULL,
    name       VARCHAR(100) NOT NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE restaurant_tables (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code       VARCHAR(50) UNIQUE NOT NULL,
    zone_id    UUID NOT NULL REFERENCES restaurant_zones(id) ON DELETE RESTRICT,
    capacity   INT NOT NULL CHECK (capacity > 0),
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Asignaciones de mesero a zona por turno
-- uq_fatiga_empleado: un empleado no puede estar en dos zonas el mismo día
-- uq_sobrecupo_zona:  una zona no puede tener dos meseros en el mismo turno y día
CREATE TABLE restaurant_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_number VARCHAR(50) NOT NULL,
    zone_id         UUID NOT NULL REFERENCES restaurant_zones(id) ON DELETE CASCADE,
    shift           VARCHAR(20) NOT NULL CHECK (shift IN ('MATUTINO', 'VESPERTINO')),
    assignment_date DATE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_fatiga_empleado  UNIQUE (employee_number, assignment_date),
    CONSTRAINT uq_sobrecupo_zona   UNIQUE (zone_id, shift, assignment_date)
);

-- ── Triggers updated_at ──────────────────────────────────────
CREATE TRIGGER update_zones_modtime
    BEFORE UPDATE ON restaurant_zones
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_tables_modtime
    BEFORE UPDATE ON restaurant_tables
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
