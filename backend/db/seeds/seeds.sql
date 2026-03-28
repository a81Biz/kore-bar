-- ============================================================
-- seeds.sql  — Kore Bar
-- Data histórica: 2026-02-01 → 2026-03-27
-- Datos activos:  2026-03-27 → 2026-04-26 (30 días)
--
-- POST-SEED: Ejecutar dentro del contenedor después de correr este archivo:
--   docker compose exec backend node db/migrations/migrate-hash-pins.js
-- ============================================================

-- ── LIMPIEZA (orden inverso de FK) ───────────────────────────
TRUNCATE TABLE
    payroll_deductions,
    employee_schedules,
    restaurant_assignments,
    attendance_records,
    shifts,
    tickets,
    payments,
    order_items,
    order_headers,
    dish_recipes,
    menu_dishes,
    menu_categories,
    inventory_kardex,
    inventory_stock_locations,
    supplier_prices,
    inventory_items,
    inventory_locations,
    suppliers,
    restaurant_tables,
    restaurant_zones,
    system_users,
    employees,
    positions,
    job_titles,
    areas,
    roles
CASCADE;

ALTER SEQUENCE ticket_folio_seq RESTART WITH 1;

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

-- ── EMPLEADOS ────────────────────────────────────────────────
-- pin_code se establece en texto plano aquí.
-- Ejecutar migrate-hash-pins.js DESPUÉS de este seed para hashear con bcrypt.
INSERT INTO employees (employee_number, first_name, last_name, hire_date, position_id, is_active, pin_code) VALUES
    ('ADMIN001', 'Carlos',    'Mendoza',    '2024-01-15', (SELECT id FROM positions WHERE code='10-01'), true, '123456'),
    ('GER-001',  'Laura',     'Herrera',    '2024-03-01', (SELECT id FROM positions WHERE code='10-02'), true, '1001'),
    ('MES-001',  'Miguel',    'Ramos',      '2025-01-10', (SELECT id FROM positions WHERE code='20-04'), true, '2001'),
    ('MES-002',  'Valentina', 'Cruz',       '2025-02-14', (SELECT id FROM positions WHERE code='20-04'), true, '2002'),
    ('MES-003',  'Diego',     'Flores',     '2025-06-01', (SELECT id FROM positions WHERE code='20-05'), true, '2003'),
    ('MES-004',  'Sofia',     'Reyes',      '2025-08-20', (SELECT id FROM positions WHERE code='20-03'), true, '2004'),
    ('BAR-001',  'Andres',    'Vega',       '2024-11-05', (SELECT id FROM positions WHERE code='50-06'), true, '5001'),
    ('COC-001',  'Roberto',   'Salinas',    '2024-05-20', (SELECT id FROM positions WHERE code='30-07'), true, '3001'),
    ('COC-002',  'Elena',     'Mora',       '2025-03-01', (SELECT id FROM positions WHERE code='30-08'), true, '3002'),
    ('COC-003',  'Hector',    'Jimenez',    '2025-09-15', (SELECT id FROM positions WHERE code='30-09'), true, '3003'),
    ('CAJ-001',  'Patricia',  'Lopez',      '2024-08-01', (SELECT id FROM positions WHERE code='40-10'), true, '4001'),
    ('LIM-001',  'Jose',      'Torres',     '2025-01-05', (SELECT id FROM positions WHERE code='60-11'), true, '6001')
ON CONFLICT (employee_number) DO UPDATE
    SET first_name  = EXCLUDED.first_name,
        last_name   = EXCLUDED.last_name,
        position_id = EXCLUDED.position_id,
        is_active   = EXCLUDED.is_active,
        pin_code    = EXCLUDED.pin_code;

-- ── SYSTEM USERS ─────────────────────────────────────────────
INSERT INTO system_users (employee_number, username, password_hash, role_id) VALUES
    ('ADMIN001', 'admin',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        (SELECT id FROM roles WHERE code='SYS_ADMIN')),
    ('GER-001',  'lherrera', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        (SELECT id FROM roles WHERE code='SYS_MANAGER')),
    ('CAJ-001',  'plopez',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        (SELECT id FROM roles WHERE code='SYS_CASHIER'))
ON CONFLICT (username) DO NOTHING;

-- ── ZONAS Y MESAS ────────────────────────────────────────────
INSERT INTO restaurant_zones (code, name) VALUES
    ('TERRAZA',  'Terraza Exterior'),
    ('SALON-A',  'Salón Principal A'),
    ('SALON-B',  'Salón VIP B'),
    ('BARRA',    'Barra de Bar')
ON CONFLICT (code) DO NOTHING;

INSERT INTO restaurant_tables (code, zone_id, capacity) VALUES
    ('T-01', (SELECT id FROM restaurant_zones WHERE code='SALON-A'), 4),
    ('T-02', (SELECT id FROM restaurant_zones WHERE code='SALON-A'), 4),
    ('T-03', (SELECT id FROM restaurant_zones WHERE code='SALON-A'), 6),
    ('T-04', (SELECT id FROM restaurant_zones WHERE code='SALON-A'), 2),
    ('T-05', (SELECT id FROM restaurant_zones WHERE code='SALON-B'), 8),
    ('T-06', (SELECT id FROM restaurant_zones WHERE code='SALON-B'), 6),
    ('T-07', (SELECT id FROM restaurant_zones WHERE code='TERRAZA'), 4),
    ('T-08', (SELECT id FROM restaurant_zones WHERE code='TERRAZA'), 4),
    ('T-09', (SELECT id FROM restaurant_zones WHERE code='TERRAZA'), 2),
    ('B-01', (SELECT id FROM restaurant_zones WHERE code='BARRA'),   2),
    ('B-02', (SELECT id FROM restaurant_zones WHERE code='BARRA'),   2)
ON CONFLICT (code) DO NOTHING;

-- ── PROVEEDORES ──────────────────────────────────────────────
INSERT INTO suppliers (code, name, contact_info) VALUES
    ('PROV-01', 'Distribuidora La Cosecha',     'Tel: 55-1234-5678 | contacto@lacosecha.mx'),
    ('PROV-02', 'Carnes Premium del Norte',     'Tel: 55-8765-4321 | ventas@carnespremium.mx'),
    ('PROV-03', 'Lácteos El Rancho',            'Tel: 55-2222-3333 | pedidos@lacteosrancho.mx'),
    ('PROV-04', 'Bebidas y Licores Mediterráneo','Tel: 55-9999-0000 | compras@mediteraneo.mx'),
    ('PROV-05', 'Abarrotes Don Felipe',         'Tel: 55-4444-5555 | don.felipe@abarrotes.mx')
ON CONFLICT (code) DO NOTHING;

-- ── INVENTARIO ───────────────────────────────────────────────
INSERT INTO inventory_items (code, name, unit_measure, recipe_unit, conversion_factor, current_stock, minimum_stock) VALUES
    ('INS-001', 'Pechuga de Pollo',       'Kg',  'g',   1000, 15.500, 5.000),
    ('INS-002', 'Filete de Res',          'Kg',  'g',   1000, 12.000, 4.000),
    ('INS-003', 'Camarones Medianos',     'Kg',  'g',   1000,  8.000, 3.000),
    ('INS-004', 'Lechuga Romana',         'Kg',  'g',   1000,  6.000, 2.000),
    ('INS-005', 'Jitomate',               'Kg',  'g',   1000, 10.000, 3.000),
    ('INS-006', 'Cebolla Blanca',         'Kg',  'g',   1000,  8.000, 2.000),
    ('INS-007', 'Papa Blanca',            'Kg',  'g',   1000, 20.000, 5.000),
    ('INS-008', 'Queso Manchego',         'Kg',  'g',   1000,  4.000, 1.000),
    ('INS-009', 'Crema Ácida',            'L',   'ml',  1000,  5.000, 1.000),
    ('INS-010', 'Aceite de Oliva',        'L',   'ml',  1000,  3.000, 0.500),
    ('INS-011', 'Cerveza Clara 355ml',    'Pz',  'Pz',     1, 96.000, 24.000),
    ('INS-012', 'Cerveza Oscura 355ml',   'Pz',  'Pz',     1, 48.000, 12.000),
    ('INS-013', 'Vino Tinto Cabernet',    'Botella','ml',750, 12.000,  3.000),
    ('INS-014', 'Tequila Blanco 750ml',   'Botella','ml',750,  6.000,  2.000),
    ('INS-015', 'Ron Añejo 750ml',        'Botella','ml',750,  4.000,  1.000),
    ('INS-016', 'Jugo de Limón',          'L',   'ml',  1000,  4.000, 1.000),
    ('INS-017', 'Sal de Mar',             'Kg',  'g',   1000,  2.000, 0.500),
    ('INS-018', 'Pimienta Negra Molida',  'Kg',  'g',   1000,  0.800, 0.200),
    ('INS-019', 'Tortilla de Maíz',       'Pz',  'Pz',     1, 200.000,50.000),
    ('INS-020', 'Pan Artesanal',          'Pz',  'Pz',     1, 30.000, 10.000)
ON CONFLICT (code) DO NOTHING;

UPDATE inventory_items SET minimum_stock = 5.000  WHERE code IN ('INS-SAL','INS-TOMATE','INS-CEBOLLA','INS-LIMON');
UPDATE inventory_items SET minimum_stock = 3.000  WHERE code IN ('INS-POLLO','INS-RES','INS-AGUACATE');
UPDATE inventory_items SET minimum_stock = 2.000  WHERE code IN ('INS-QUESO','INS-CREMA');
UPDATE inventory_items SET minimum_stock = 10.000 WHERE code LIKE 'INS-COCA%' OR code LIKE 'INS-CERVEZA%';

-- ── PRECIOS DE PROVEEDOR ─────────────────────────────────────
INSERT INTO supplier_prices (supplier_id, item_id, price, lead_time_days) VALUES
    ((SELECT id FROM suppliers WHERE code='PROV-02'), (SELECT id FROM inventory_items WHERE code='INS-001'), 85.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-02'), (SELECT id FROM inventory_items WHERE code='INS-002'), 220.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-02'), (SELECT id FROM inventory_items WHERE code='INS-003'), 180.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-01'), (SELECT id FROM inventory_items WHERE code='INS-004'), 28.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-01'), (SELECT id FROM inventory_items WHERE code='INS-005'), 22.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-01'), (SELECT id FROM inventory_items WHERE code='INS-006'), 18.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-01'), (SELECT id FROM inventory_items WHERE code='INS-007'), 15.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-03'), (SELECT id FROM inventory_items WHERE code='INS-008'), 120.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-03'), (SELECT id FROM inventory_items WHERE code='INS-009'), 45.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-04'), (SELECT id FROM inventory_items WHERE code='INS-011'), 18.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-04'), (SELECT id FROM inventory_items WHERE code='INS-012'), 22.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-04'), (SELECT id FROM inventory_items WHERE code='INS-013'), 280.00, 3),
    ((SELECT id FROM suppliers WHERE code='PROV-04'), (SELECT id FROM inventory_items WHERE code='INS-014'), 320.00, 3),
    ((SELECT id FROM suppliers WHERE code='PROV-05'), (SELECT id FROM inventory_items WHERE code='INS-019'), 2.50, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-05'), (SELECT id FROM inventory_items WHERE code='INS-020'), 8.00, 1)
ON CONFLICT (supplier_id, item_id) DO NOTHING;

-- ── UBICACIONES DE INVENTARIO ────────────────────────────────
INSERT INTO inventory_locations (code, name, type) VALUES
    ('LOC-BODEGA', 'Bodega Principal',        'BODEGA'),
    ('LOC-COCINA', 'Estación de Cocina',      'OPERATION'),
    ('LOC-BARRA',  'Estación de Barra',       'OPERATION'),
    ('LOC-PISO',   'Estación de Piso/Meseros', 'OPERATION')
ON CONFLICT (code) DO NOTHING;

-- Stock por ubicación
INSERT INTO inventory_stock_locations (item_id, location_id, stock) VALUES
    -- Bodega
    ((SELECT id FROM inventory_items WHERE code='INS-001'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'),  10.000),
    ((SELECT id FROM inventory_items WHERE code='INS-002'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'),   8.000),
    ((SELECT id FROM inventory_items WHERE code='INS-003'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'),   5.000),
    ((SELECT id FROM inventory_items WHERE code='INS-011'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'),  72.000),
    ((SELECT id FROM inventory_items WHERE code='INS-012'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'),  36.000),
    ((SELECT id FROM inventory_items WHERE code='INS-013'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'),  12.000),
    -- Cocina
    ((SELECT id FROM inventory_items WHERE code='INS-001'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'),   5.500),
    ((SELECT id FROM inventory_items WHERE code='INS-002'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'),   4.000),
    ((SELECT id FROM inventory_items WHERE code='INS-003'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'),   3.000),
    -- Barra
    ((SELECT id FROM inventory_items WHERE code='INS-011'), (SELECT id FROM inventory_locations WHERE code='LOC-BARRA'),   24.000),
    ((SELECT id FROM inventory_items WHERE code='INS-012'), (SELECT id FROM inventory_locations WHERE code='LOC-BARRA'),   12.000),
    ((SELECT id FROM inventory_items WHERE code='INS-013'), (SELECT id FROM inventory_locations WHERE code='LOC-BARRA'),   12.000),
    ((SELECT id FROM inventory_items WHERE code='INS-014'), (SELECT id FROM inventory_locations WHERE code='LOC-BARRA'),    6.000),
    -- Piso (bebidas que los meseros sirven directamente)
    ((SELECT id FROM inventory_items WHERE code='INS-011'), (SELECT id FROM inventory_locations WHERE code='LOC-PISO'),   12.000),
    ((SELECT id FROM inventory_items WHERE code='INS-012'), (SELECT id FROM inventory_locations WHERE code='LOC-PISO'),    6.000),
    ((SELECT id FROM inventory_items WHERE code='INS-019'), (SELECT id FROM inventory_locations WHERE code='LOC-PISO'),   50.000)
ON CONFLICT (item_id, location_id) DO NOTHING;

-- ── MENÚ ─────────────────────────────────────────────────────
INSERT INTO menu_categories (code, name, description, route_to_kds) VALUES
    ('ENT',  'Entradas',           'Sopas, ensaladas y botanas',    true),
    ('PLA',  'Platos Fuertes',     'Carnes, mariscos y especialidades', true),
    ('POST', 'Postres',            'Dulces y bebidas calientes',    true),
    ('BEB',  'Bebidas Sin Alcohol','Aguas, refrescos y jugos',      false),
    ('ALC',  'Bebidas con Alcohol','Cervezas, vinos y cócteles',    false)
ON CONFLICT (code) DO NOTHING;

-- FIX: Asegurar route_to_kds aunque la categoría ya exista
UPDATE menu_categories SET route_to_kds = false WHERE code IN ('BEB', 'ALC');
UPDATE menu_categories SET route_to_kds = true  WHERE code IN ('ENT', 'PLA', 'POST');

INSERT INTO menu_dishes (code, category_id, name, description, price, is_active, has_recipe) VALUES
    ('ENT-01',(SELECT id FROM menu_categories WHERE code='ENT'),'Ensalada César','Lechuga romana, crutones, aderezo césar y queso parmesano',125.00,true,true),
    ('ENT-02',(SELECT id FROM menu_categories WHERE code='ENT'),'Sopa de Lima','Sopa yucateca con lima, pollo desmenuzado y totopos',110.00,true,true),
    ('ENT-03',(SELECT id FROM menu_categories WHERE code='ENT'),'Tostadas de Camarón','3 tostadas con camarón al mojo de ajo, aguacate y pico de gallo',165.00,true,true),
    ('PLA-01',(SELECT id FROM menu_categories WHERE code='PLA'),'Pechuga a la Plancha','Pechuga de pollo con guarnición de verduras y papas',195.00,true,true),
    ('PLA-02',(SELECT id FROM menu_categories WHERE code='PLA'),'Filete Mariposa','Filete de res en término medio con papas y ensalada',320.00,true,true),
    ('PLA-03',(SELECT id FROM menu_categories WHERE code='PLA'),'Camarones al Ajillo','Camarones salteados con mantequilla, ajo y chile',285.00,true,true),
    ('PLA-04',(SELECT id FROM menu_categories WHERE code='PLA'),'Tacos de Pastor','Orden de 3 tacos con carne de cerdo adobada',135.00,true,false),
    ('PLA-05',(SELECT id FROM menu_categories WHERE code='PLA'),'Enchiladas Verdes','3 enchiladas con salsa verde, pollo y crema',155.00,true,false),
    ('POST-01',(SELECT id FROM menu_categories WHERE code='POST'),'Flan Napolitano','Flan de la casa con cajeta y crema',80.00,true,false),
    ('POST-02',(SELECT id FROM menu_categories WHERE code='POST'),'Pay de Queso','Porción de pay de queso con mermelada de fresa',90.00,true,false),
    ('BEB-01',(SELECT id FROM menu_categories WHERE code='BEB'),'Agua de Jamaica','Vaso grande de agua fresca de jamaica',45.00,true,false),
    ('BEB-02',(SELECT id FROM menu_categories WHERE code='BEB'),'Limonada Natural','Limonada fresca con menta',55.00,true,false),
    ('BEB-03',(SELECT id FROM menu_categories WHERE code='BEB'),'Refresco',NULL,40.00,true,false),
    ('ALC-01',(SELECT id FROM menu_categories WHERE code='ALC'),'Cerveza Clara',NULL,65.00,true,false),
    ('ALC-02',(SELECT id FROM menu_categories WHERE code='ALC'),'Cerveza Oscura',NULL,75.00,true,false),
    ('ALC-03',(SELECT id FROM menu_categories WHERE code='ALC'),'Copa de Vino Tinto',NULL,120.00,true,false),
    ('ALC-04',(SELECT id FROM menu_categories WHERE code='ALC'),'Margarita Clásica','Tequila, triple sec y limón',135.00,true,false),
    ('ALC-05',(SELECT id FROM menu_categories WHERE code='ALC'),'Mojito','Ron, menta, limón y agua mineral',130.00,true,false)
ON CONFLICT (code) DO NOTHING;

-- ── RECETAS (BOM) ────────────────────────────────────────────
INSERT INTO dish_recipes (dish_id, item_id, quantity_required) VALUES
    -- Ensalada César
    ((SELECT id FROM menu_dishes WHERE code='ENT-01'),(SELECT id FROM inventory_items WHERE code='INS-004'),150.000),
    ((SELECT id FROM menu_dishes WHERE code='ENT-01'),(SELECT id FROM inventory_items WHERE code='INS-008'),30.000),
    -- Sopa de Lima
    ((SELECT id FROM menu_dishes WHERE code='ENT-02'),(SELECT id FROM inventory_items WHERE code='INS-001'),120.000),
    -- Tostadas de Camarón
    ((SELECT id FROM menu_dishes WHERE code='ENT-03'),(SELECT id FROM inventory_items WHERE code='INS-003'),150.000),
    ((SELECT id FROM menu_dishes WHERE code='ENT-03'),(SELECT id FROM inventory_items WHERE code='INS-019'),3.000),
    -- Pechuga
    ((SELECT id FROM menu_dishes WHERE code='PLA-01'),(SELECT id FROM inventory_items WHERE code='INS-001'),220.000),
    ((SELECT id FROM menu_dishes WHERE code='PLA-01'),(SELECT id FROM inventory_items WHERE code='INS-007'),200.000),
    -- Filete
    ((SELECT id FROM menu_dishes WHERE code='PLA-02'),(SELECT id FROM inventory_items WHERE code='INS-002'),280.000),
    ((SELECT id FROM menu_dishes WHERE code='PLA-02'),(SELECT id FROM inventory_items WHERE code='INS-007'),200.000),
    -- Camarones
    ((SELECT id FROM menu_dishes WHERE code='PLA-03'),(SELECT id FROM inventory_items WHERE code='INS-003'),250.000),
    ((SELECT id FROM menu_dishes WHERE code='PLA-03'),(SELECT id FROM inventory_items WHERE code='INS-010'),30.000)
ON CONFLICT (dish_id, item_id) DO NOTHING;

-- ── TURNOS ───────────────────────────────────────────────────
INSERT INTO shift_catalog (code, name, start_time, end_time) VALUES
    ('MATUTINO',   'Turno Matutino',   '08:00', '16:00'),
    ('VESPERTINO', 'Turno Vespertino', '16:00', '00:00')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- DATOS HISTÓRICOS: Feb 1 – Mar 26, 2026
-- ============================================================

-- ── HORARIOS DE STAFF (employee_schedules) ───────────────────
-- Históricos: Feb 1 → Mar 26  |  Activos: Mar 27 → Abr 26
DO $$
DECLARE
    v_date DATE := '2026-02-01';
    v_end  DATE := CURRENT_DATE + INTERVAL '30 days';
BEGIN
    WHILE v_date <= v_end LOOP
        INSERT INTO employee_schedules (employee_number, shift_code, schedule_date)
        VALUES
            ('CAJ-001', 'MATUTINO',   v_date),
            ('COC-001', 'MATUTINO',   v_date),
            ('COC-002', 'VESPERTINO', v_date),
            ('COC-003', 'MATUTINO',   v_date),
            ('BAR-001', 'VESPERTINO', v_date),
            ('LIM-001', 'MATUTINO',   v_date)
        ON CONFLICT (employee_number, schedule_date) DO NOTHING;
        v_date := v_date + INTERVAL '1 day';
    END LOOP;
END;
$$;

-- ── ASIGNACIONES DE MESEROS (restaurant_assignments) ─────────
-- Históricos: Feb 1 → Mar 26  |  Activos: Mar 27 → Abr 26
DO $$
DECLARE
    v_date   DATE := '2026-02-01';
    v_end    DATE := CURRENT_DATE + INTERVAL '30 days';
    v_zone_a UUID := (SELECT id FROM restaurant_zones WHERE code = 'SALON-A');
    v_zone_b UUID := (SELECT id FROM restaurant_zones WHERE code = 'SALON-B');
    v_zone_t UUID := (SELECT id FROM restaurant_zones WHERE code = 'TERRAZA');
BEGIN
    WHILE v_date <= v_end LOOP
        -- Solo lunes a sábado (dow: 1=lun, 6=sab)
        IF EXTRACT(DOW FROM v_date) BETWEEN 1 AND 6 THEN
            INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
            VALUES ('MES-001', v_zone_a, 'MATUTINO', v_date)
            ON CONFLICT DO NOTHING;
            INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
            VALUES ('MES-002', v_zone_t, 'MATUTINO', v_date)
            ON CONFLICT DO NOTHING;
            INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
            VALUES ('MES-003', v_zone_a, 'VESPERTINO', v_date)
            ON CONFLICT DO NOTHING;
            -- Host MES-004 en Salón B solo vie-sáb
            IF EXTRACT(DOW FROM v_date) IN (5, 6) THEN
                INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
                VALUES ('MES-004', v_zone_b, 'VESPERTINO', v_date)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
        v_date := v_date + INTERVAL '1 day';
    END LOOP;
END;
$$;

-- ── ASISTENCIAS (historial Feb 1 → Mar 26) ──────────────────
DO $$
DECLARE
    v_date DATE := '2026-02-01';
BEGIN
    WHILE v_date <= '2026-03-26' LOOP
        IF EXTRACT(DOW FROM v_date) BETWEEN 1 AND 6 THEN
            -- Miércoles 12 de febrero: MES-001 faltó
            IF v_date <> '2026-02-12' THEN
                INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
                VALUES ('MES-001', 'WAITERS', v_date, v_date + TIME '08:05:00')
                ON CONFLICT DO NOTHING;
            END IF;
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES ('MES-002', 'WAITERS', v_date, v_date + TIME '08:12:00')
            ON CONFLICT DO NOTHING;
            -- MES-003 faltó el 5 de marzo
            IF v_date <> '2026-03-05' THEN
                INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
                VALUES ('MES-003', 'WAITERS', v_date, v_date + TIME '16:02:00')
                ON CONFLICT DO NOTHING;
            END IF;
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES ('CAJ-001', 'CASHIER', v_date, v_date + TIME '07:58:00')
            ON CONFLICT DO NOTHING;
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES ('COC-001', 'KITCHEN', v_date, v_date + TIME '07:50:00')
            ON CONFLICT DO NOTHING;
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES ('COC-002', 'KITCHEN', v_date, v_date + TIME '15:55:00')
            ON CONFLICT DO NOTHING;
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES ('COC-003', 'KITCHEN', v_date, v_date + TIME '08:10:00')
            ON CONFLICT DO NOTHING;
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES ('BAR-001', 'WAITERS', v_date, v_date + TIME '16:00:00')
            ON CONFLICT DO NOTHING;
        END IF;
        v_date := v_date + INTERVAL '1 day';
    END LOOP;
END;
$$;

-- ── DESCUENTOS NÓMINA ────────────────────────────────────────
CALL sp_create_payroll_deduction('MES-001', '2026-02-12', 'FALTA_INJUSTIFICADA', 'No se presentó sin avisar', 'ADMIN001');
CALL sp_create_payroll_deduction('MES-003', '2026-03-05', 'RETARDO',             'Llegó 45 min tarde al turno', 'GER-001');
CALL sp_create_payroll_deduction('COC-003', '2026-03-15', 'DIA_ECONOMICO',       'Solicitud personal aprobada', 'GER-001');
CALL sp_create_payroll_deduction('MES-002', '2026-02-28', 'PERMISO_SIN_GOCE',    'Asunto familiar', 'GER-001');

-- ── ÓRDENES Y PAGOS HISTÓRICOS ───────────────────────────────
DO $$
DECLARE
    v_date        DATE;
    v_order_id    UUID;
    v_order_code  TEXT;
    v_ticket_id   UUID;
    v_folio       TEXT;
    v_table_codes TEXT[]  := ARRAY['T-01','T-02','T-03','T-04','T-07','T-08'];
    v_table_id    UUID;
    v_waiter_id   UUID;
    v_cashier_id  UUID;
    v_dish1_id    UUID;
    v_dish2_id    UUID;
    v_dish3_id    UUID;
    v_total       DECIMAL(12,2);
    v_seq         INT := 1;
    v_day_orders  INT;
    i             INT;
    t             TEXT;
    v_method      TEXT;
    v_tip         DECIMAL(12,2);
BEGIN
    v_cashier_id := (SELECT id FROM employees WHERE employee_number = 'CAJ-001');
    v_waiter_id  := (SELECT id FROM employees WHERE employee_number = 'MES-001');
    v_dish1_id   := (SELECT id FROM menu_dishes WHERE code = 'PLA-01');
    v_dish2_id   := (SELECT id FROM menu_dishes WHERE code = 'ENT-01');
    v_dish3_id   := (SELECT id FROM menu_dishes WHERE code = 'ALC-01');

    v_date := '2026-02-01';

    WHILE v_date <= '2026-03-26' LOOP
        IF EXTRACT(DOW FROM v_date) BETWEEN 1 AND 6 THEN
            v_day_orders := 8 + (EXTRACT(DOW FROM v_date)::INT % 10);

            FOR i IN 1..v_day_orders LOOP
                t := v_table_codes[1 + ((i - 1) % array_length(v_table_codes, 1))];
                v_table_id   := (SELECT id FROM restaurant_tables WHERE code = t);
                v_order_code := 'ORD-' || TO_CHAR(v_date, 'YYYYMMDD') || '-' || LPAD(i::TEXT, 3, '0');

                v_total := ROUND((195 + (i * 37 + EXTRACT(DOY FROM v_date)::INT * 3) % 555)::NUMERIC, 2);

                INSERT INTO order_headers (id, code, table_id, waiter_id, diners, status, total, created_at, updated_at)
                VALUES (
                    gen_random_uuid(), v_order_code, v_table_id, v_waiter_id,
                    1 + (i % 5), 'CLOSED', v_total,
                    v_date + TIME '13:00:00' + (i * INTERVAL '15 minutes'),
                    v_date + TIME '14:30:00' + (i * INTERVAL '15 minutes')
                )
                ON CONFLICT (code) DO NOTHING
                RETURNING id INTO v_order_id;

                IF v_order_id IS NOT NULL THEN
                    INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status)
                    VALUES (v_order_id, v_dish1_id, 1, 195.00, 195.00, 'DELIVERED');

                    IF v_total > 300 THEN
                        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status)
                        VALUES (v_order_id, v_dish2_id, 1, 125.00, 125.00, 'DELIVERED');
                    END IF;

                    INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status)
                    VALUES (v_order_id, v_dish3_id, 1 + (i % 3), 65.00, (1 + (i % 3)) * 65.00, 'DELIVERED');

                    v_method := CASE WHEN i % 3 = 0 THEN 'CARD' WHEN i % 3 = 1 THEN 'CASH' ELSE 'TRANSFER' END;
                    v_tip    := CASE WHEN v_method = 'CARD' THEN ROUND((v_total * 0.1)::NUMERIC, 2) ELSE 0.00 END;

                    INSERT INTO payments (order_id, method, amount, tip, cashier_id, created_at)
                    VALUES (v_order_id, v_method, v_total, v_tip, v_cashier_id,
                            v_date + TIME '14:30:00' + (i * INTERVAL '15 minutes'));

                    v_folio := 'TKT-' || TO_CHAR(v_date, 'YYYYMMDD') || '-' || LPAD(v_seq::TEXT, 4, '0');
                    v_seq   := v_seq + 1;

                    INSERT INTO tickets (folio, order_id, subtotal, tax, tip_total, total, created_at)
                    VALUES (v_folio, v_order_id, v_total, ROUND((v_total * 0.16)::NUMERIC, 2), v_tip,
                            ROUND((v_total * 1.16 + v_tip)::NUMERIC, 2),
                            v_date + TIME '14:32:00' + (i * INTERVAL '15 minutes'))
                    ON CONFLICT DO NOTHING;
                END IF;
            END LOOP;
        END IF;
        v_date := v_date + INTERVAL '1 day';
    END LOOP;
END;
$$;

-- ── KARDEX DE INVENTARIO (compras históricas) ────────────────
INSERT INTO inventory_kardex (item_id, from_location_id, to_location_id, transaction_type, quantity, reference_id, date) VALUES
    ((SELECT id FROM inventory_items WHERE code='INS-001'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 30.000, 'OC-2026-0201', '2026-02-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-002'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 20.000, 'OC-2026-0201', '2026-02-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-003'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 15.000, 'OC-2026-0201', '2026-02-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-011'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 240.000, 'OC-2026-0201', '2026-02-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-012'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 120.000, 'OC-2026-0201', '2026-02-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-013'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 24.000, 'OC-2026-0201', '2026-02-01 09:00:00-06'),
    -- Reabastecimiento de marzo
    ((SELECT id FROM inventory_items WHERE code='INS-001'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 25.000, 'OC-2026-0301', '2026-03-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-002'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 18.000, 'OC-2026-0301', '2026-03-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-011'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 144.000, 'OC-2026-0301', '2026-03-01 09:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-014'), NULL, (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), 'IN_PURCHASE', 6.000, 'OC-2026-0315', '2026-03-15 09:00:00-06'),
    -- Transferencias Bodega → Cocina
    ((SELECT id FROM inventory_items WHERE code='INS-001'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'), 'TRANSFER', 5.000, 'TRF-2026-0205', '2026-02-05 08:30:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-002'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'), 'TRANSFER', 4.000, 'TRF-2026-0205', '2026-02-05 08:30:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-011'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), (SELECT id FROM inventory_locations WHERE code='LOC-BARRA'),  'TRANSFER', 48.000, 'TRF-2026-0210', '2026-02-10 16:00:00-06'),
    -- Transferencias Bodega → Piso
    ((SELECT id FROM inventory_items WHERE code='INS-011'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), (SELECT id FROM inventory_locations WHERE code='LOC-PISO'),   'TRANSFER', 12.000, 'TRF-2026-0215', '2026-02-15 08:00:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-012'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), (SELECT id FROM inventory_locations WHERE code='LOC-PISO'),   'TRANSFER', 6.000,  'TRF-2026-0215', '2026-02-15 08:00:00-06'),
    -- Ajuste de inventario (merma)
    ((SELECT id FROM inventory_items WHERE code='INS-003'), (SELECT id FROM inventory_locations WHERE code='LOC-BODEGA'), NULL, 'ADJUSTMENT', -1.500, 'MERMA-FEB-01', '2026-02-28 23:00:00-06');

-- ── Salidas por ventas (muestra) ─────────────────────────────
INSERT INTO inventory_kardex (item_id, from_location_id, to_location_id, transaction_type, quantity, reference_id, date) VALUES
    ((SELECT id FROM inventory_items WHERE code='INS-001'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'), NULL, 'OUT_SALE', 8.800, 'VENTAS-FEB-S1', '2026-02-07 23:59:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-002'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'), NULL, 'OUT_SALE', 5.600, 'VENTAS-FEB-S1', '2026-02-07 23:59:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-011'), (SELECT id FROM inventory_locations WHERE code='LOC-BARRA'),  NULL, 'OUT_SALE', 36.000,'VENTAS-FEB-S1', '2026-02-07 23:59:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-001'), (SELECT id FROM inventory_locations WHERE code='LOC-COCINA'), NULL, 'OUT_SALE', 9.200, 'VENTAS-MAR-S1', '2026-03-07 23:59:00-06'),
    ((SELECT id FROM inventory_items WHERE code='INS-011'), (SELECT id FROM inventory_locations WHERE code='LOC-BARRA'),  NULL, 'OUT_SALE', 48.000,'VENTAS-MAR-S1', '2026-03-07 23:59:00-06');

-- ── TURNOS (shifts) — historial + activos ────────────────────
-- Feb 1 → ayer: COMPLETED  |  Hoy: ACTIVE
DO $$
DECLARE
    v_date     DATE;
    v_start_ts TIMESTAMPTZ;
    v_end_ts   TIMESTAMPTZ;
    v_emp_id   UUID;
    v_aus      DATE[];
    v_status   TEXT;
    i          INT;

    v_nums TEXT[] := ARRAY['ADMIN001','GER-001','MES-001','MES-002','MES-003',
                            'MES-004','BAR-001','COC-001','COC-002','COC-003',
                            'CAJ-001','LIM-001'];
    v_sh   TEXT[] := ARRAY['08:00','08:00','08:00','08:00','16:00',
                            '16:00','16:00','08:00','16:00','08:00',
                            '08:00','08:00'];
    v_eh   TEXT[] := ARRAY['16:00','16:00','16:00','16:00','00:00',
                            '00:00','00:00','16:00','00:00','16:00',
                            '16:00','16:00'];
BEGIN
    FOR i IN 1..array_length(v_nums, 1) LOOP

        SELECT id INTO v_emp_id FROM employees WHERE employee_number = v_nums[i];
        IF v_emp_id IS NULL THEN CONTINUE; END IF;

        -- Ausencias según empleado
        v_aus := CASE i
            WHEN  3 THEN ARRAY['2026-02-12'::DATE]
            WHEN  4 THEN ARRAY['2026-02-28'::DATE]
            WHEN  5 THEN ARRAY['2026-03-05'::DATE]
            WHEN 10 THEN ARRAY['2026-03-15'::DATE]
            ELSE ARRAY[]::DATE[]
        END;

        v_date := '2026-02-01';
        WHILE v_date <= CURRENT_DATE LOOP
            IF EXTRACT(DOW FROM v_date) BETWEEN 1 AND 6
               AND NOT (v_date = ANY(v_aus))
            THEN
                v_start_ts := (v_date::TEXT || ' ' || v_sh[i] || ':00-06')::TIMESTAMPTZ;
                IF v_eh[i] = '00:00' THEN
                    v_end_ts := ((v_date + 1)::TEXT || ' 00:00:00-06')::TIMESTAMPTZ;
                ELSE
                    v_end_ts := (v_date::TEXT || ' ' || v_eh[i] || ':00-06')::TIMESTAMPTZ;
                END IF;

                -- Hoy = ACTIVE, días anteriores = COMPLETED
                v_status := CASE WHEN v_date = CURRENT_DATE THEN 'ACTIVE' ELSE 'COMPLETED' END;

                INSERT INTO shifts (employee_id, start_time, end_time, status)
                VALUES (v_emp_id, v_start_ts, v_end_ts, v_status);
            END IF;
            v_date := v_date + INTERVAL '1 day';
        END LOOP;
    END LOOP;
END;
$$;

-- ============================================================
-- POST-SEED: Hashear PINs
-- Los PINs se insertaron en texto plano arriba.
-- Ejecutar DESPUÉS de este archivo:
--
--   docker compose exec backend node db/migrations/migrate-hash-pins.js
--
-- Esto convierte todos los pin_code a hashes bcrypt.
-- PINs por defecto:
--   ADMIN001 → 123456
--   Todos los demás → 1234
-- ============================================================

-- ── FIN ───────────────────────────────────────────────────────