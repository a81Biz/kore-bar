-- ============================================================
-- 01_hr.sql
-- Módulo de Recursos Humanos
-- Dependencias: 00_core.sql
-- Tablas: roles, areas, job_titles, positions, employees,
--         system_users, shifts
-- ============================================================

-- Catálogo de roles de sistema (permisos de acceso)
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Áreas físicas o lógicas del negocio
-- NOTA: can_access_cashier controla qué empleados aparecen en el login de caja
CREATE TABLE areas (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                VARCHAR(50) UNIQUE NOT NULL,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    can_access_cashier  BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo genérico de puestos de trabajo
CREATE TABLE job_titles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pivot: une un Área con un Puesto para definir una Posición exacta
CREATE TABLE positions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50) UNIQUE NOT NULL,
    area_id         UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    job_title_id    UUID NOT NULL REFERENCES job_titles(id) ON DELETE RESTRICT,
    default_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(area_id, job_title_id)
);

-- Empleados físicos
CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    hire_date       DATE,
    position_id     UUID REFERENCES positions(id) ON DELETE RESTRICT,
    pin_code        VARCHAR(10) UNIQUE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios de sistema (acceso lógico)
CREATE TABLE system_users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         UUID REFERENCES roles(id) ON DELETE RESTRICT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Turnos de trabajo
CREATE TABLE shifts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_time  TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time    TIMESTAMP WITH TIME ZONE,
    status      VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Triggers updated_at ──────────────────────────────────────
CREATE TRIGGER update_roles_modtime
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_areas_modtime
    BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_job_titles_modtime
    BEFORE UPDATE ON job_titles
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_positions_modtime
    BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_employees_modtime
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_system_users_modtime
    BEFORE UPDATE ON system_users
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
