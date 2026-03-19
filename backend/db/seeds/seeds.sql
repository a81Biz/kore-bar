-- ============================================================
-- seeds.sql
-- Datos iniciales de desarrollo
-- Dependencias: todos los módulos
-- ============================================================

-- ── ROLES ────────────────────────────────────────────────────
INSERT INTO roles (code, name, description) VALUES
    ('SYS_ADMIN',   'Administrador',  'Acceso total al sistema'),
    ('SYS_MANAGER', 'Gerente',        'Gestión de operaciones y reportes'),
    ('SYS_CASHIER', 'Cajero',         'Cobros y cortes de caja'),
    ('SYS_WAITER',  'Operativo POS',  'Toma de órdenes y mesas')
ON CONFLICT (code) DO NOTHING;

-- ── ÁREAS (con permiso de caja para Caja/Gerencia) ───────────
INSERT INTO areas (code, name, can_access_cashier) VALUES
    ('10', 'Gerencia', true),
    ('20', 'Piso',     false),
    ('30', 'Cocina',   false),
    ('40', 'Caja',     true)
ON CONFLICT (code) DO NOTHING;

-- ── PUESTOS ──────────────────────────────────────────────────
INSERT INTO job_titles (code, name) VALUES
    ('01', 'Host'),
    ('04', 'Mesero General'),
    ('07', 'Chef Ejecutivo'),
    ('10', 'Cajero Principal')
ON CONFLICT (code) DO NOTHING;

-- ── POSICIONES ───────────────────────────────────────────────
INSERT INTO positions (code, area_id, job_title_id, default_role_id) VALUES
    ('10-01',
        (SELECT id FROM areas WHERE code = '10'),
        (SELECT id FROM job_titles WHERE code = '01'),
        (SELECT id FROM roles WHERE code = 'SYS_MANAGER')),
    ('20-04',
        (SELECT id FROM areas WHERE code = '20'),
        (SELECT id FROM job_titles WHERE code = '04'),
        (SELECT id FROM roles WHERE code = 'SYS_WAITER')),
    ('30-07',
        (SELECT id FROM areas WHERE code = '30'),
        (SELECT id FROM job_titles WHERE code = '07'),
        (SELECT id FROM roles WHERE code = 'SYS_MANAGER')),
    ('40-10',
        (SELECT id FROM areas WHERE code = '40'),
        (SELECT id FROM job_titles WHERE code = '10'),
        (SELECT id FROM roles WHERE code = 'SYS_CASHIER'))
ON CONFLICT (code) DO NOTHING;

-- ── EMPLEADO ADMIN ───────────────────────────────────────────
INSERT INTO employees (employee_number, first_name, last_name, hire_date) VALUES
    ('ADMIN001', 'Super', 'Admin', CURRENT_DATE)
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO system_users (employee_number, username, password_hash, role_id) VALUES
    ('ADMIN001', 'admin', 'admin123_hash',
        (SELECT id FROM roles WHERE code = 'SYS_ADMIN'))
ON CONFLICT (username) DO NOTHING;

-- ── UBICACIONES DE INVENTARIO ────────────────────────────────
INSERT INTO inventory_locations (code, name, type) VALUES
    ('LOC-BODEGA', 'Bodega Principal',       'BODEGA'),
    ('LOC-COCINA', 'Estación de Cocina',     'OPERATION'),
    ('LOC-PISO',   'Estación de Piso y Barra', 'OPERATION')
ON CONFLICT (code) DO NOTHING;
