-- ============================================================
-- seeds-core.sql — Kore Bar
-- Datos estructurales mínimos para que la app funcione.
-- 100% idempotente: ON CONFLICT DO NOTHING en todo.
-- SIN TRUNCATE — nunca borra datos existentes.
-- ============================================================

-- ── ROLES ────────────────────────────────────────────────────
INSERT INTO roles (code, name, description) VALUES
    ('SYS_ADMIN',   'Administrador', 'Acceso total al sistema'),
    ('SYS_MANAGER', 'Gerente',       'Gestión de operaciones y reportes'),
    ('SYS_CASHIER', 'Cajero',        'Cobros y cortes de caja'),
    ('SYS_WAITER',  'Mesero POS',    'Toma de órdenes y mesas')
ON CONFLICT (code) DO NOTHING;

-- ── ÁREAS ────────────────────────────────────────────────────
INSERT INTO areas (code, name, can_access_cashier) VALUES
    ('10', 'Gerencia',       true),
    ('20', 'Piso',           false),
    ('30', 'Cocina',         false),
    ('40', 'Caja',           true),
    ('50', 'Bar',            false),
    ('60', 'Mantenimiento',  false)
ON CONFLICT (code) DO NOTHING;

-- ── PUESTOS ──────────────────────────────────────────────────
INSERT INTO job_titles (code, name) VALUES
    ('01', 'Gerente General'),
    ('02', 'Subgerente'),
    ('03', 'Host / Hostess'),
    ('04', 'Mesero General'),
    ('05', 'Mesero Senior'),
    ('06', 'Barista / Bartender'),
    ('07', 'Chef Ejecutivo'),
    ('08', 'Cocinero'),
    ('09', 'Auxiliar de Cocina'),
    ('10', 'Cajero Principal'),
    ('11', 'Auxiliar de Limpieza')
ON CONFLICT (code) DO NOTHING;

-- ── POSICIONES ───────────────────────────────────────────────
INSERT INTO positions (code, area_id, job_title_id, default_role_id) VALUES
    ('10-01', (SELECT id FROM areas WHERE code='10'), (SELECT id FROM job_titles WHERE code='01'), (SELECT id FROM roles WHERE code='SYS_ADMIN')),
    ('10-02', (SELECT id FROM areas WHERE code='10'), (SELECT id FROM job_titles WHERE code='02'), (SELECT id FROM roles WHERE code='SYS_MANAGER')),
    ('20-03', (SELECT id FROM areas WHERE code='20'), (SELECT id FROM job_titles WHERE code='03'), (SELECT id FROM roles WHERE code='SYS_WAITER')),
    ('20-04', (SELECT id FROM areas WHERE code='20'), (SELECT id FROM job_titles WHERE code='04'), (SELECT id FROM roles WHERE code='SYS_WAITER')),
    ('20-05', (SELECT id FROM areas WHERE code='20'), (SELECT id FROM job_titles WHERE code='05'), (SELECT id FROM roles WHERE code='SYS_WAITER')),
    ('50-06', (SELECT id FROM areas WHERE code='50'), (SELECT id FROM job_titles WHERE code='06'), (SELECT id FROM roles WHERE code='SYS_WAITER')),
    ('30-07', (SELECT id FROM areas WHERE code='30'), (SELECT id FROM job_titles WHERE code='07'), (SELECT id FROM roles WHERE code='SYS_MANAGER')),
    ('30-08', (SELECT id FROM areas WHERE code='30'), (SELECT id FROM job_titles WHERE code='08'), (SELECT id FROM roles WHERE code='SYS_WAITER')),
    ('30-09', (SELECT id FROM areas WHERE code='30'), (SELECT id FROM job_titles WHERE code='09'), (SELECT id FROM roles WHERE code='SYS_WAITER')),
    ('40-10', (SELECT id FROM areas WHERE code='40'), (SELECT id FROM job_titles WHERE code='10'), (SELECT id FROM roles WHERE code='SYS_CASHIER')),
    ('60-11', (SELECT id FROM areas WHERE code='60'), (SELECT id FROM job_titles WHERE code='11'), (SELECT id FROM roles WHERE code='SYS_WAITER'))
ON CONFLICT (code) DO NOTHING;

-- ── TURNOS ───────────────────────────────────────────────────
INSERT INTO shift_catalog (code, name, start_time, end_time) VALUES
    ('MATUTINO',   'Turno Matutino',   '08:00', '16:00'),
    ('VESPERTINO', 'Turno Vespertino', '16:00', '00:00')
ON CONFLICT (code) DO NOTHING;

-- ── CUENTA ADMIN BOOTSTRAP ───────────────────────────────────
-- Sin esta cuenta no hay forma de entrar al sistema en un deploy nuevo.
-- El PIN se establece en texto plano; ejecutar migrate-hash-pins.js o
-- llamar a reset-pin desde el panel para activar el hash bcrypt.
INSERT INTO employees (employee_number, first_name, last_name, hire_date, position_id, is_active, pin_code)
VALUES ('ADMIN001', 'Admin', 'Sistema', CURRENT_DATE,
        (SELECT id FROM positions WHERE code = '10-01'), true, '123456')
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO system_users (employee_number, username, password_hash, role_id)
VALUES ('ADMIN001', 'admin',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        (SELECT id FROM roles WHERE code = 'SYS_ADMIN'))
ON CONFLICT (username) DO NOTHING;

-- ── UBICACIONES DE INVENTARIO ────────────────────────────────
INSERT INTO inventory_locations (code, name, type) VALUES
    ('LOC-BODEGA', 'Bodega Principal',         'BODEGA'),
    ('LOC-COCINA', 'Estación de Cocina',       'OPERATION'),
    ('LOC-BARRA',  'Estación de Barra',        'OPERATION'),
    ('LOC-PISO',   'Estación de Piso/Meseros', 'OPERATION')
ON CONFLICT (code) DO NOTHING;
