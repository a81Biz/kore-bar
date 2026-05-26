-- ============================================================
-- seeds-demo.sql — Kore Bar
-- Datos de demostración coherentes para ciclo completo de servicio.
-- Fecha de referencia: 2026-05-25
--
-- 100% idempotente — ON CONFLICT DO NOTHING en todo.
-- SIN TRUNCATE — seguro en producción.
-- PINs ya hasheados con bcrypt (sin necesidad de migrate-hash-pins.js).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. ACTUALIZAR PIN DE ADMIN001 (bcrypt de '123456')
-- ════════════════════════════════════════════════════════════
UPDATE employees
SET    pin_code   = '$2a$10$oKsNbti4TY30WUcc.sC0AOJOexjnIZTKMjSE8FVGv6R8xqc4C8t02',
       updated_at = NOW()
WHERE  employee_number = 'ADMIN001'
  AND  pin_code NOT LIKE '$2%';


-- ════════════════════════════════════════════════════════════
-- 2. EMPLEADOS
-- ════════════════════════════════════════════════════════════
INSERT INTO employees (employee_number, first_name, last_name, hire_date, position_id, is_active, pin_code) VALUES
    ('GER-001',  'Lucía',      'Herrera',  '2024-03-01', (SELECT id FROM positions WHERE code='10-02'), true, '$2a$10$l2Tl4j.O5tHdRsPi3EwoeuiUbGWozyNmOxp6e.fb4aVb4EJSCFeuW'),
    ('MES-001',  'Miguel',     'Ramos',    '2025-01-10', (SELECT id FROM positions WHERE code='20-04'), true, '$2a$10$tiBGGGqilA9djJ759dRC/estkdAZf1kObCfCvK3PHGowUqAOXyQwe'),
    ('MES-002',  'Valentina',  'Cruz',     '2025-02-14', (SELECT id FROM positions WHERE code='20-04'), true, '$2a$10$LzkEufM4N7O3LB1437.0t.i4lRY5TDuZpH6GEsCk2FIPewBrMsU.O'),
    ('MES-003',  'Diego',      'Flores',   '2025-06-01', (SELECT id FROM positions WHERE code='20-05'), true, '$2a$10$CQomjDcKArxwqCRjv.hhnOkWPrDtksV11CsH4sCip6dCcFyWttwvq'),
    ('MES-004',  'Sofía',      'Reyes',    '2025-08-20', (SELECT id FROM positions WHERE code='20-03'), true, '$2a$10$/kpM5ku4e82GA7ZBm6LQw.NLDSNIYsCvRzxTN5C65pFooufoeU9oC'),
    ('COC-001',  'Roberto',    'García',   '2024-05-15', (SELECT id FROM positions WHERE code='30-07'), true, '$2a$10$5o6Y.5HHG.sKUPQvExIjueBZ9rXRi03Lqq3NgYOkjKMq1IXuy2K0m'),
    ('COC-002',  'Patricia',   'López',    '2024-09-01', (SELECT id FROM positions WHERE code='30-08'), true, '$2a$10$eGZFIyN/DrNKbtEpCcjaw.cTaafij9PigzE.txKw4ECx6IYSyFeyi'),
    ('COC-003',  'Héctor',     'Méndez',   '2025-03-10', (SELECT id FROM positions WHERE code='30-08'), true, '$2a$10$qgpw.xlrtBBv/PyOsc6kU.4D7L166KrA3S9C2JTL0X/2okuo8ZmXK'),
    ('BAR-001',  'José',       'Torres',   '2024-11-05', (SELECT id FROM positions WHERE code='50-06'), true, '$2a$10$VY6/mJ2MT1MG5pa5i34Z7uLjMO7AvTPtL/7crC8ShUlNDUW3ht0Vu'),
    ('CAJ-001',  'Camila',     'Díaz',     '2025-04-01', (SELECT id FROM positions WHERE code='40-10'), true, '$2a$10$1ZF1UUZK47GDVttEvtFfBeNtGJ7Al1DINC8UVz07pTPpXmQ0p4idS'),
    ('LIM-001',  'Francisco',  'Ruiz',     '2025-07-01', (SELECT id FROM positions WHERE code='60-11'), true, '$2a$10$QMI0xfmIDd1DgBVs0jHpg.gD4kNgFBsY0EMwIkHF/blR.M0g5I0hi')
ON CONFLICT (employee_number) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 3. USUARIO DE SISTEMA — GER-001 (Gerente, login web)
-- ════════════════════════════════════════════════════════════
INSERT INTO system_users (employee_number, username, password_hash, role_id, is_active)
VALUES (
    'GER-001',
    'gerente',
    '$2a$10$QukCFIRWsa7bY4zs2lKUkOZTlw4Np2C8FK2imh5eSKd05nRmupX1G',
    (SELECT id FROM roles WHERE code = 'SYS_MANAGER'),
    true
) ON CONFLICT (employee_number) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 4. ZONAS Y MESAS
-- ════════════════════════════════════════════════════════════
INSERT INTO restaurant_zones (code, name, is_active) VALUES
    ('ZONA-TERRAZA', 'Terraza Exterior',  true),
    ('ZONA-SALON',   'Salón Principal',   true),
    ('ZONA-VIP',     'Área VIP',          true),
    ('ZONA-BARRA',   'Barra del Bar',     true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO restaurant_tables (code, zone_id, capacity, is_active) VALUES
    ('T-01', (SELECT id FROM restaurant_zones WHERE code='ZONA-TERRAZA'), 4, true),
    ('T-02', (SELECT id FROM restaurant_zones WHERE code='ZONA-TERRAZA'), 4, true),
    ('T-03', (SELECT id FROM restaurant_zones WHERE code='ZONA-TERRAZA'), 6, true),
    ('T-04', (SELECT id FROM restaurant_zones WHERE code='ZONA-TERRAZA'), 2, true),
    ('T-05', (SELECT id FROM restaurant_zones WHERE code='ZONA-SALON'),   4, true),
    ('T-06', (SELECT id FROM restaurant_zones WHERE code='ZONA-SALON'),   4, true),
    ('T-07', (SELECT id FROM restaurant_zones WHERE code='ZONA-SALON'),   8, true),
    ('T-08', (SELECT id FROM restaurant_zones WHERE code='ZONA-SALON'),   4, true),
    ('T-09', (SELECT id FROM restaurant_zones WHERE code='ZONA-VIP'),     6, true),
    ('T-10', (SELECT id FROM restaurant_zones WHERE code='ZONA-VIP'),     8, true),
    ('T-B1', (SELECT id FROM restaurant_zones WHERE code='ZONA-BARRA'),   8, true)
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 5. PROVEEDORES
-- ════════════════════════════════════════════════════════════
INSERT INTO suppliers (code, name, contact_info, is_active) VALUES
    ('PROV-CARNICOS', 'Carnes y Mariscos Selectos S.A.',  'Tel: 55-1234-5678 | contacto@carnicos.mx',     true),
    ('PROV-VERDURAS', 'Verduras Frescas del Valle',        'Tel: 55-2345-6789 | pedidos@verdurasvalle.mx', true),
    ('PROV-LACTEOS',  'Lácteos Premium del Norte',         'Tel: 55-3456-7890 | ventas@lacteospremium.mx', true),
    ('PROV-ABARROTES','Distribuidora El Surtidor',         'Tel: 55-4567-8901 | surtidor@dsurtidor.mx',    true),
    ('PROV-BEBIDAS',  'Bebidas y Refrescos S.A. de C.V.',  'Tel: 55-5678-9012 | bebidas@byr.mx',           true)
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 6. INSUMOS DE INVENTARIO
-- unit_measure  = unidad de compra (lo que llega del proveedor)
-- recipe_unit   = unidad de receta (lo que se usa en cocina)
-- conversion_factor: 1 unidad de compra = N unidades de receta
-- current_stock = stock total referencial (la fuente real es stock_locations)
-- minimum_stock = umbral que dispara sugerencias automáticas
-- ════════════════════════════════════════════════════════════
INSERT INTO inventory_items (code, name, unit_measure, recipe_unit, conversion_factor, current_stock, minimum_stock, is_active) VALUES
    -- Proteínas (Kg compra → g receta)
    ('INS-POLLO',    'Pollo Entero',        'Kg',   'g',  1000.0000, 18000.000, 10000.000, true),
    ('INS-RES',      'Carne de Res',        'Kg',   'g',  1000.0000, 10000.000,  5000.000, true),
    ('INS-CERDO',    'Lomo de Cerdo',       'Kg',   'g',  1000.0000,  5000.000,  3000.000, true),
    ('INS-PULPO',    'Pulpo Fresco',        'Kg',   'g',  1000.0000,  8000.000,  3000.000, true),
    ('INS-CAMARON',  'Camarón Mediano',     'Kg',   'g',  1000.0000,  4000.000,  2000.000, true),
    -- Verduras y frutas
    ('INS-LECHUGA',  'Lechuga Romana',      'Pz',  'Pz',     1.0000,    20.000,    10.000, true),
    ('INS-TOMATE',   'Jitomate',            'Kg',   'g',  1000.0000,  7000.000,  3000.000, true),
    ('INS-CEBOLLA',  'Cebolla Blanca',      'Kg',   'g',  1000.0000,  5500.000,  2000.000, true),
    ('INS-AJO',      'Ajo',                 'Kg',   'g',  1000.0000,  1200.000,   500.000, true),
    ('INS-CHILE',    'Chile Jalapeño',      'Kg',   'g',  1000.0000,  2500.000,  1000.000, true),
    -- Lácteos (stock BAJO — dispara sugerencias automáticas)
    ('INS-QUESO',    'Queso Manchego',      'Kg',   'g',  1000.0000,   400.000,  2000.000, true),
    ('INS-CREMA',    'Crema Ácida',         'L',   'ml',  1000.0000,   300.000,  2000.000, true),
    -- Cítrico (stock BAJO — dispara sugerencias automáticas)
    ('INS-LIMON',    'Limón Persa',         'Kg',   'g',  1000.0000,   500.000,  2000.000, true),
    -- Abarrotes
    ('INS-ACEITE',   'Aceite Vegetal',      'L',   'ml',  1000.0000, 12000.000,  5000.000, true),
    ('INS-TORTILLA', 'Tortilla de Maíz',    'Pz',  'Pz',     1.0000,   200.000,   100.000, true),
    ('INS-PAN',      'Pan de Caja',         'Pz',  'Pz',     1.0000,    45.000,    20.000, true),
    ('INS-ARROZ',    'Arroz Blanco',        'Kg',   'g',  1000.0000, 10000.000,  3000.000, true),
    ('INS-FRIJOL',   'Frijol Negro',        'Kg',   'g',  1000.0000,  6500.000,  2000.000, true),
    -- Bebidas (Caja compra → Pz receta)
    ('INS-CERV-CL',  'Cerveza Clara',       'Caja', 'Pz',   24.0000,   120.000,    48.000, true),
    ('INS-CERV-OS',  'Cerveza Oscura',      'Caja', 'Pz',   24.0000,    96.000,    48.000, true),
    ('INS-REFRESCO', 'Refresco de Lata',    'Caja', 'Pz',   24.0000,   144.000,    48.000, true),
    ('INS-AGUA',     'Agua Mineral 600ml',  'Pz',  'Pz',     1.0000,    50.000,    24.000, true),
    ('INS-AZUCAR',   'Azúcar Estándar',     'Kg',   'g',  1000.0000,  5000.000,  1000.000, true)
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 7. PRECIOS POR PROVEEDOR (con lead_time para sugerencias)
-- El SP elige: menor precio → menor lead_time como desempate.
-- INS-QUESO, INS-CREMA, INS-LIMON tienen stock bajo → se generarán DRAFTs.
-- ════════════════════════════════════════════════════════════
INSERT INTO supplier_prices (supplier_id, item_id, price, lead_time_days) VALUES
    -- PROV-CARNICOS
    ((SELECT id FROM suppliers WHERE code='PROV-CARNICOS'), (SELECT id FROM inventory_items WHERE code='INS-POLLO'),   85.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-CARNICOS'), (SELECT id FROM inventory_items WHERE code='INS-RES'),    130.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-CARNICOS'), (SELECT id FROM inventory_items WHERE code='INS-CERDO'),   95.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-CARNICOS'), (SELECT id FROM inventory_items WHERE code='INS-PULPO'),  210.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-CARNICOS'), (SELECT id FROM inventory_items WHERE code='INS-CAMARON'),185.00, 1),
    -- PROV-VERDURAS
    ((SELECT id FROM suppliers WHERE code='PROV-VERDURAS'), (SELECT id FROM inventory_items WHERE code='INS-LECHUGA'),  8.50, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-VERDURAS'), (SELECT id FROM inventory_items WHERE code='INS-TOMATE'),  22.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-VERDURAS'), (SELECT id FROM inventory_items WHERE code='INS-CEBOLLA'), 18.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-VERDURAS'), (SELECT id FROM inventory_items WHERE code='INS-AJO'),     45.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-VERDURAS'), (SELECT id FROM inventory_items WHERE code='INS-CHILE'),   35.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-VERDURAS'), (SELECT id FROM inventory_items WHERE code='INS-LIMON'),   28.00, 1),
    -- PROV-LACTEOS
    ((SELECT id FROM suppliers WHERE code='PROV-LACTEOS'),  (SELECT id FROM inventory_items WHERE code='INS-QUESO'),  180.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-LACTEOS'),  (SELECT id FROM inventory_items WHERE code='INS-CREMA'),   42.00, 2),
    -- Segundo proveedor de lácteos: más caro, 1 día (desempate)
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-QUESO'),  195.00, 1),
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-CREMA'),   48.00, 1),
    -- PROV-ABARROTES
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-ACEITE'),  32.00, 3),
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-TORTILLA'), 0.80, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-PAN'),      2.50, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-ARROZ'),   22.00, 3),
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-FRIJOL'),  35.00, 3),
    ((SELECT id FROM suppliers WHERE code='PROV-ABARROTES'),(SELECT id FROM inventory_items WHERE code='INS-AZUCAR'),  18.00, 3),
    -- PROV-BEBIDAS
    ((SELECT id FROM suppliers WHERE code='PROV-BEBIDAS'),  (SELECT id FROM inventory_items WHERE code='INS-CERV-CL'), 420.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-BEBIDAS'),  (SELECT id FROM inventory_items WHERE code='INS-CERV-OS'), 480.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-BEBIDAS'),  (SELECT id FROM inventory_items WHERE code='INS-REFRESCO'),320.00, 2),
    ((SELECT id FROM suppliers WHERE code='PROV-BEBIDAS'),  (SELECT id FROM inventory_items WHERE code='INS-AGUA'),     18.00, 2)
ON CONFLICT (supplier_id, item_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 8. STOCK POR UBICACIÓN
-- Estado actual al inicio de turno 2026-05-25
-- LOC-BODEGA: stock principal
-- LOC-COCINA: ya surtido para servicio de hoy
-- LOC-BARRA:  bebidas ya surtidas + algunas aún en bodega (pendiente de traspaso)
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_bodega  UUID;
    v_cocina  UUID;
    v_barra   UUID;
BEGIN
    SELECT id INTO v_bodega FROM inventory_locations WHERE code = 'LOC-BODEGA';
    SELECT id INTO v_cocina FROM inventory_locations WHERE code = 'LOC-COCINA';
    SELECT id INTO v_barra  FROM inventory_locations WHERE code = 'LOC-BARRA';

    -- Proteínas en bodega y cocina
    INSERT INTO inventory_stock_locations (item_id, location_id, stock) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-POLLO'),   v_bodega, 15000), -- 15 Kg en bodega
        ((SELECT id FROM inventory_items WHERE code='INS-POLLO'),   v_cocina,  3000), -- 3 Kg en cocina
        ((SELECT id FROM inventory_items WHERE code='INS-RES'),     v_bodega,  8000),
        ((SELECT id FROM inventory_items WHERE code='INS-RES'),     v_cocina,  2000),
        ((SELECT id FROM inventory_items WHERE code='INS-CERDO'),   v_bodega,  4000),
        ((SELECT id FROM inventory_items WHERE code='INS-CERDO'),   v_cocina,  1000),
        ((SELECT id FROM inventory_items WHERE code='INS-PULPO'),   v_bodega,  6000),
        ((SELECT id FROM inventory_items WHERE code='INS-PULPO'),   v_cocina,  2000),
        ((SELECT id FROM inventory_items WHERE code='INS-CAMARON'), v_bodega,  3000),
        ((SELECT id FROM inventory_items WHERE code='INS-CAMARON'), v_cocina,  1000),
        -- Verduras
        ((SELECT id FROM inventory_items WHERE code='INS-LECHUGA'), v_bodega,    15),
        ((SELECT id FROM inventory_items WHERE code='INS-LECHUGA'), v_cocina,     5),
        ((SELECT id FROM inventory_items WHERE code='INS-TOMATE'),  v_bodega,  5000),
        ((SELECT id FROM inventory_items WHERE code='INS-TOMATE'),  v_cocina,  2000),
        ((SELECT id FROM inventory_items WHERE code='INS-CEBOLLA'), v_bodega,  4000),
        ((SELECT id FROM inventory_items WHERE code='INS-CEBOLLA'), v_cocina,  1500),
        ((SELECT id FROM inventory_items WHERE code='INS-AJO'),     v_bodega,  1000),
        ((SELECT id FROM inventory_items WHERE code='INS-AJO'),     v_cocina,   200),
        ((SELECT id FROM inventory_items WHERE code='INS-CHILE'),   v_bodega,  2000),
        ((SELECT id FROM inventory_items WHERE code='INS-CHILE'),   v_cocina,   500),
        -- Lácteos BAJOS (dispararán sugerencias automáticas)
        ((SELECT id FROM inventory_items WHERE code='INS-QUESO'),   v_bodega,   400), -- ← por debajo de mínimo 2000
        ((SELECT id FROM inventory_items WHERE code='INS-QUESO'),   v_cocina,   200),
        ((SELECT id FROM inventory_items WHERE code='INS-CREMA'),   v_bodega,   300), -- ← por debajo de mínimo 2000
        ((SELECT id FROM inventory_items WHERE code='INS-CREMA'),   v_cocina,   500),
        -- Limón BAJO
        ((SELECT id FROM inventory_items WHERE code='INS-LIMON'),   v_bodega,   500), -- ← por debajo de mínimo 2000
        ((SELECT id FROM inventory_items WHERE code='INS-LIMON'),   v_cocina,  1000),
        ((SELECT id FROM inventory_items WHERE code='INS-LIMON'),   v_barra,    200),
        -- Abarrotes
        ((SELECT id FROM inventory_items WHERE code='INS-ACEITE'),  v_bodega, 10000),
        ((SELECT id FROM inventory_items WHERE code='INS-ACEITE'),  v_cocina,  2000),
        ((SELECT id FROM inventory_items WHERE code='INS-TORTILLA'),v_bodega,   150),
        ((SELECT id FROM inventory_items WHERE code='INS-TORTILLA'),v_cocina,    50),
        ((SELECT id FROM inventory_items WHERE code='INS-PAN'),     v_bodega,    40),
        ((SELECT id FROM inventory_items WHERE code='INS-ARROZ'),   v_bodega,  8000),
        ((SELECT id FROM inventory_items WHERE code='INS-ARROZ'),   v_cocina,  2000),
        ((SELECT id FROM inventory_items WHERE code='INS-FRIJOL'),  v_bodega,  5000),
        ((SELECT id FROM inventory_items WHERE code='INS-FRIJOL'),  v_cocina,  1500),
        ((SELECT id FROM inventory_items WHERE code='INS-AZUCAR'),  v_bodega,  5000),
        ((SELECT id FROM inventory_items WHERE code='INS-AZUCAR'),  v_cocina,   500),
        -- Bebidas en barra (ya surtidas)
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-CL'), v_barra,    72),
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-OS'), v_barra,    72),
        ((SELECT id FROM inventory_items WHERE code='INS-REFRESCO'),v_barra,    96),
        ((SELECT id FROM inventory_items WHERE code='INS-AGUA'),    v_barra,    26),
        -- Bebidas en bodega PENDIENTES DE TRASPASO A BARRA
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-CL'), v_bodega,   48),
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-OS'), v_bodega,   24),
        ((SELECT id FROM inventory_items WHERE code='INS-REFRESCO'),v_bodega,   48),
        ((SELECT id FROM inventory_items WHERE code='INS-AGUA'),    v_bodega,   24)
    ON CONFLICT (item_id, location_id) DO NOTHING;
END $$;


-- ════════════════════════════════════════════════════════════
-- 9. KARDEX — HISTORIAL DE MOVIMIENTOS
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_bodega UUID;
    v_cocina UUID;
    v_barra  UUID;
BEGIN
    SELECT id INTO v_bodega FROM inventory_locations WHERE code = 'LOC-BODEGA';
    SELECT id INTO v_cocina FROM inventory_locations WHERE code = 'LOC-COCINA';
    SELECT id INTO v_barra  FROM inventory_locations WHERE code = 'LOC-BARRA';

    -- Mayo 10: Recepción de carnes (compra PROV-CARNICOS)
    INSERT INTO inventory_kardex (item_id, transaction_type, quantity, reference_id, to_location_id, date) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-POLLO'),   'IN_PURCHASE', 20000, 'PO-MAY10-CARNICOS', v_bodega, '2026-05-10 10:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-RES'),     'IN_PURCHASE', 12000, 'PO-MAY10-CARNICOS', v_bodega, '2026-05-10 10:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-CERDO'),   'IN_PURCHASE',  6000, 'PO-MAY10-CARNICOS', v_bodega, '2026-05-10 10:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-CAMARON'), 'IN_PURCHASE',  5000, 'PO-MAY10-CARNICOS', v_bodega, '2026-05-10 10:00:00+00');

    -- Mayo 10: Traspasos de bodega a cocina (servicio del día)
    INSERT INTO inventory_kardex (item_id, from_location_id, to_location_id, transaction_type, quantity, reference_id, date) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-POLLO'),   v_bodega, v_cocina, 'TRANSFER', 5000, 'TRASPASO-20260510', '2026-05-10 14:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-RES'),     v_bodega, v_cocina, 'TRANSFER', 4000, 'TRASPASO-20260510', '2026-05-10 14:00:00+00');

    -- Mayo 15: Recepción de abarrotes (PROV-ABARROTES)
    INSERT INTO inventory_kardex (item_id, transaction_type, quantity, reference_id, to_location_id, date) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-ACEITE'),   'IN_PURCHASE', 15000, 'PO-MAY15-ABARROTES', v_bodega, '2026-05-15 09:30:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-TORTILLA'), 'IN_PURCHASE',   300, 'PO-MAY15-ABARROTES', v_bodega, '2026-05-15 09:30:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-ARROZ'),    'IN_PURCHASE', 15000, 'PO-MAY15-ABARROTES', v_bodega, '2026-05-15 09:30:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-FRIJOL'),   'IN_PURCHASE', 10000, 'PO-MAY15-ABARROTES', v_bodega, '2026-05-15 09:30:00+00');

    -- Mayo 20: Recepción de bebidas (PROV-BEBIDAS)
    INSERT INTO inventory_kardex (item_id, transaction_type, quantity, reference_id, to_location_id, date) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-CL'),  'IN_PURCHASE', 168, 'PO-MAY20-BEBIDAS', v_bodega, '2026-05-20 11:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-OS'),  'IN_PURCHASE', 120, 'PO-MAY20-BEBIDAS', v_bodega, '2026-05-20 11:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-REFRESCO'), 'IN_PURCHASE', 192, 'PO-MAY20-BEBIDAS', v_bodega, '2026-05-20 11:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-AGUA'),     'IN_PURCHASE',  72, 'PO-MAY20-BEBIDAS', v_bodega, '2026-05-20 11:00:00+00');

    -- Mayo 20: Traspaso parcial de bebidas a barra
    INSERT INTO inventory_kardex (item_id, from_location_id, to_location_id, transaction_type, quantity, reference_id, date) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-CL'),  v_bodega, v_barra, 'TRANSFER', 72, 'TRASPASO-BARRA-20260520', '2026-05-20 15:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-CERV-OS'),  v_bodega, v_barra, 'TRANSFER', 72, 'TRASPASO-BARRA-20260520', '2026-05-20 15:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-REFRESCO'), v_bodega, v_barra, 'TRANSFER', 96, 'TRASPASO-BARRA-20260520', '2026-05-20 15:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-AGUA'),     v_bodega, v_barra, 'TRANSFER', 26, 'TRASPASO-BARRA-20260520', '2026-05-20 15:00:00+00');

    -- Mayo 25 mañana: Recepción de pulpo y proteínas frescas
    INSERT INTO inventory_kardex (item_id, transaction_type, quantity, reference_id, to_location_id, date) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-PULPO'),    'IN_PURCHASE',  8000, 'PO-MAY25-CARNICOS', v_bodega, '2026-05-25 08:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-POLLO'),    'IN_PURCHASE',  6000, 'PO-MAY25-CARNICOS', v_bodega, '2026-05-25 08:00:00+00');

    -- Mayo 25: Traspasos a cocina para servicio del día
    INSERT INTO inventory_kardex (item_id, from_location_id, to_location_id, transaction_type, quantity, reference_id, date) VALUES
        ((SELECT id FROM inventory_items WHERE code='INS-PULPO'),    v_bodega, v_cocina, 'TRANSFER', 2000, 'TRASPASO-COCINA-20260525', '2026-05-25 09:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-POLLO'),    v_bodega, v_cocina, 'TRANSFER', 3000, 'TRASPASO-COCINA-20260525', '2026-05-25 09:00:00+00'),
        ((SELECT id FROM inventory_items WHERE code='INS-RES'),      v_bodega, v_cocina, 'TRANSFER', 2000, 'TRASPASO-COCINA-20260525', '2026-05-25 09:00:00+00');
END $$;


-- ════════════════════════════════════════════════════════════
-- 10. CATEGORÍAS Y PLATILLOS DEL MENÚ
-- ════════════════════════════════════════════════════════════
INSERT INTO menu_categories (code, name, description, can_pickup, route_to_kds, is_active) VALUES
    ('ENT', 'Entradas',   'Sopas, ensaladas y botanas',          false, true,  true),
    ('PLA', 'Platos',     'Platos fuertes y especialidades',     false, true,  true),
    ('POS', 'Postres',    'Postres de mostrador y vitrina',      true,  false, true),
    ('BEB', 'Bebidas',    'Bebidas sin alcohol y refrescos',     true,  false, true),
    ('COC', 'Cócteles',   'Cócteles y bebidas preparadas',       true,  false, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO menu_dishes (code, category_id, name, description, price, has_recipe, can_pickup, is_active) VALUES
    -- Entradas
    ('ENS-CES',  (SELECT id FROM menu_categories WHERE code='ENT'), 'Ensalada César',           'Lechuga romana, aderezo César, queso manchego, crutones',        89.00, true,  false, true),
    ('GUA-TOT',  (SELECT id FROM menu_categories WHERE code='ENT'), 'Guacamole con Totopos',    'Aguacate fresco, jitomate, cebolla, chile jalapeño',             79.00, true,  false, true),
    ('SOP-LIM',  (SELECT id FROM menu_categories WHERE code='ENT'), 'Sopa de Lima',             'Caldo de pollo, lima, tortilla frita, chile jalapeño',           75.00, true,  false, true),
    -- Platos
    ('PEC-PLA',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Pechuga a la Plancha',     'Pechuga de pollo marinada, limón, aceite de oliva',             145.00, true,  false, true),
    ('FIL-MIG',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Filete Mignon',            'Corte de res, mantequilla de hierbas, guarnición del día',      285.00, true,  false, true),
    ('ENC-VER',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Enchiladas Verdes',        'Tortillas bañadas en salsa verde, crema y queso manchego',       125.00, true,  false, true),
    ('TAC-BIS',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Tacos de Bistec',          '3 tacos con cebolla, cilantro y salsa de la casa',              165.00, true,  false, true),
    ('CAM-MOJ',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Camarones al Mojo de Ajo', 'Camarones salteados en mantequilla, ajo y limón',               225.00, true,  false, true),
    ('PUL-BRA',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Pulpo a la Brasa',         'Pulpo asado, aceite de oliva, limón, pico de gallo',            265.00, true,  false, true),
    ('ARR-PAP',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Arrachera con Papas',      'Corte de arrachera, papas cambray, chimichurri',                195.00, true,  false, true),
    ('POL-LIM',  (SELECT id FROM menu_categories WHERE code='PLA'), 'Pollo al Limón',           'Pollo en salsa cítrica, arroz y verduras',                       155.00, true,  false, true),
    -- Postres (sin receta — se preparan en vitrina, mesero recoge directamente)
    ('FLA-CAS',  (SELECT id FROM menu_categories WHERE code='POS'), 'Flan de la Casa',          'Flan napolitano con cajeta y nuez',                              65.00, false, true,  true),
    ('BRO-HEL',  (SELECT id FROM menu_categories WHERE code='POS'), 'Brownie con Helado',       'Brownie de chocolate caliente con helado de vainilla',           75.00, false, true,  true),
    ('FRU-TEM',  (SELECT id FROM menu_categories WHERE code='POS'), 'Fruta de Temporada',       'Fruta fresca de temporada con chamoy y chilito',                 55.00, false, true,  true),
    -- Bebidas (no van a KDS, mesero recoge de barra)
    ('CER-CLA',  (SELECT id FROM menu_categories WHERE code='BEB'), 'Cerveza Clara',            'Cerveza rubia fría 355ml',                                       45.00, false, true,  true),
    ('CER-OSC',  (SELECT id FROM menu_categories WHERE code='BEB'), 'Cerveza Oscura',           'Cerveza oscura fría 355ml',                                      55.00, false, true,  true),
    ('AGU-MIN',  (SELECT id FROM menu_categories WHERE code='BEB'), 'Agua Mineral',             'Agua mineral 600ml',                                             35.00, false, true,  true),
    ('REF-LAT',  (SELECT id FROM menu_categories WHERE code='BEB'), 'Refresco de Lata',         'Refresco de lata 355ml variedad del cliente',                    40.00, false, true,  true),
    ('AGU-FRE',  (SELECT id FROM menu_categories WHERE code='BEB'), 'Agua Fresca de Temporada', 'Agua fresca hecha en casa, sabor del día',                        35.00, true,  true,  true),
    -- Cócteles
    ('MAR-CLA',  (SELECT id FROM menu_categories WHERE code='COC'), 'Margarita Clásica',        'Tequila, triple sec, limón, sal',                                95.00, true,  true,  true),
    ('MOJ-CLA',  (SELECT id FROM menu_categories WHERE code='COC'), 'Mojito',                   'Ron blanco, menta, limón, azúcar, soda',                         89.00, true,  true,  true),
    ('CUB-LIB',  (SELECT id FROM menu_categories WHERE code='COC'), 'Cuba Libre',               'Ron, refresco de cola, limón',                                   79.00, false, true,  true)
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 11. RECETAS (BOM) — qué insumos usa cada platillo
-- Las cantidades están en recipe_unit (g, ml, Pz)
-- ════════════════════════════════════════════════════════════
INSERT INTO dish_recipes (dish_id, item_id, quantity_required) VALUES
    -- Ensalada César
    ((SELECT id FROM menu_dishes WHERE code='ENS-CES'), (SELECT id FROM inventory_items WHERE code='INS-LECHUGA'),  1.000),
    ((SELECT id FROM menu_dishes WHERE code='ENS-CES'), (SELECT id FROM inventory_items WHERE code='INS-QUESO'),   30.000),
    ((SELECT id FROM menu_dishes WHERE code='ENS-CES'), (SELECT id FROM inventory_items WHERE code='INS-ACEITE'),  20.000),
    -- Guacamole con Totopos
    ((SELECT id FROM menu_dishes WHERE code='GUA-TOT'), (SELECT id FROM inventory_items WHERE code='INS-TOMATE'),  80.000),
    ((SELECT id FROM menu_dishes WHERE code='GUA-TOT'), (SELECT id FROM inventory_items WHERE code='INS-CEBOLLA'), 40.000),
    ((SELECT id FROM menu_dishes WHERE code='GUA-TOT'), (SELECT id FROM inventory_items WHERE code='INS-CHILE'),   10.000),
    -- Sopa de Lima
    ((SELECT id FROM menu_dishes WHERE code='SOP-LIM'), (SELECT id FROM inventory_items WHERE code='INS-POLLO'),  150.000),
    ((SELECT id FROM menu_dishes WHERE code='SOP-LIM'), (SELECT id FROM inventory_items WHERE code='INS-LIMON'),   20.000),
    ((SELECT id FROM menu_dishes WHERE code='SOP-LIM'), (SELECT id FROM inventory_items WHERE code='INS-CHILE'),   10.000),
    ((SELECT id FROM menu_dishes WHERE code='SOP-LIM'), (SELECT id FROM inventory_items WHERE code='INS-TORTILLA'), 3.000),
    -- Pechuga a la Plancha
    ((SELECT id FROM menu_dishes WHERE code='PEC-PLA'), (SELECT id FROM inventory_items WHERE code='INS-POLLO'),  250.000),
    ((SELECT id FROM menu_dishes WHERE code='PEC-PLA'), (SELECT id FROM inventory_items WHERE code='INS-LIMON'),   15.000),
    ((SELECT id FROM menu_dishes WHERE code='PEC-PLA'), (SELECT id FROM inventory_items WHERE code='INS-ACEITE'),  25.000),
    -- Filete Mignon
    ((SELECT id FROM menu_dishes WHERE code='FIL-MIG'), (SELECT id FROM inventory_items WHERE code='INS-RES'),    250.000),
    ((SELECT id FROM menu_dishes WHERE code='FIL-MIG'), (SELECT id FROM inventory_items WHERE code='INS-ACEITE'),  30.000),
    ((SELECT id FROM menu_dishes WHERE code='FIL-MIG'), (SELECT id FROM inventory_items WHERE code='INS-AJO'),      5.000),
    -- Enchiladas Verdes
    ((SELECT id FROM menu_dishes WHERE code='ENC-VER'), (SELECT id FROM inventory_items WHERE code='INS-TORTILLA'), 6.000),
    ((SELECT id FROM menu_dishes WHERE code='ENC-VER'), (SELECT id FROM inventory_items WHERE code='INS-POLLO'),  120.000),
    ((SELECT id FROM menu_dishes WHERE code='ENC-VER'), (SELECT id FROM inventory_items WHERE code='INS-CREMA'),   40.000),
    ((SELECT id FROM menu_dishes WHERE code='ENC-VER'), (SELECT id FROM inventory_items WHERE code='INS-QUESO'),   35.000),
    ((SELECT id FROM menu_dishes WHERE code='ENC-VER'), (SELECT id FROM inventory_items WHERE code='INS-CHILE'),   15.000),
    -- Tacos de Bistec
    ((SELECT id FROM menu_dishes WHERE code='TAC-BIS'), (SELECT id FROM inventory_items WHERE code='INS-RES'),    180.000),
    ((SELECT id FROM menu_dishes WHERE code='TAC-BIS'), (SELECT id FROM inventory_items WHERE code='INS-TORTILLA'), 6.000),
    ((SELECT id FROM menu_dishes WHERE code='TAC-BIS'), (SELECT id FROM inventory_items WHERE code='INS-CEBOLLA'), 30.000),
    ((SELECT id FROM menu_dishes WHERE code='TAC-BIS'), (SELECT id FROM inventory_items WHERE code='INS-TOMATE'),  40.000),
    -- Pulpo a la Brasa (nuevo platillo)
    ((SELECT id FROM menu_dishes WHERE code='PUL-BRA'), (SELECT id FROM inventory_items WHERE code='INS-PULPO'),  250.000),
    ((SELECT id FROM menu_dishes WHERE code='PUL-BRA'), (SELECT id FROM inventory_items WHERE code='INS-LIMON'),   30.000),
    ((SELECT id FROM menu_dishes WHERE code='PUL-BRA'), (SELECT id FROM inventory_items WHERE code='INS-ACEITE'),  30.000),
    ((SELECT id FROM menu_dishes WHERE code='PUL-BRA'), (SELECT id FROM inventory_items WHERE code='INS-AJO'),      8.000),
    -- Agua Fresca de Temporada
    ((SELECT id FROM menu_dishes WHERE code='AGU-FRE'), (SELECT id FROM inventory_items WHERE code='INS-LIMON'),   50.000),
    ((SELECT id FROM menu_dishes WHERE code='AGU-FRE'), (SELECT id FROM inventory_items WHERE code='INS-AZUCAR'),  30.000),
    -- Margarita Clásica
    ((SELECT id FROM menu_dishes WHERE code='MAR-CLA'), (SELECT id FROM inventory_items WHERE code='INS-LIMON'),   25.000),
    -- Mojito
    ((SELECT id FROM menu_dishes WHERE code='MOJ-CLA'), (SELECT id FROM inventory_items WHERE code='INS-LIMON'),   20.000),
    ((SELECT id FROM menu_dishes WHERE code='MOJ-CLA'), (SELECT id FROM inventory_items WHERE code='INS-AZUCAR'),  15.000)
ON CONFLICT (dish_id, item_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 12. ASIGNACIONES DE ZONA (MESEROS DE PISO) — Mayo 1–25
-- MES-004 (Sofía) NO tiene asignación hoy (Mayo 25) — escenario sin asignar
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_date        DATE;
    v_terraza_id  UUID;
    v_salon_id    UUID;
    v_vip_id      UUID;
    v_barra_id    UUID;
BEGIN
    SELECT id INTO v_terraza_id FROM restaurant_zones WHERE code = 'ZONA-TERRAZA';
    SELECT id INTO v_salon_id   FROM restaurant_zones WHERE code = 'ZONA-SALON';
    SELECT id INTO v_vip_id     FROM restaurant_zones WHERE code = 'ZONA-VIP';
    SELECT id INTO v_barra_id   FROM restaurant_zones WHERE code = 'ZONA-BARRA';

    FOR v_date IN SELECT generate_series('2026-05-01'::date, '2026-05-25'::date, '1 day'::interval)::date
    LOOP
        INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date) VALUES
            ('MES-001', v_terraza_id, 'MATUTINO', v_date),
            ('MES-002', v_salon_id,   'MATUTINO', v_date),
            ('MES-003', v_vip_id,     'MATUTINO', v_date)
        ON CONFLICT (employee_number, assignment_date) DO NOTHING;

        -- Sofía solo trabaja hasta el día 24 (hoy 25 no tiene asignación)
        IF v_date < '2026-05-25'::date THEN
            INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date) VALUES
                ('MES-004', v_barra_id, 'MATUTINO', v_date)
            ON CONFLICT (employee_number, assignment_date) DO NOTHING;
        END IF;
    END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════
-- 13. HORARIOS DE STAFF NO-PISO (employee_schedules) — Mayo 1–25
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_date DATE;
BEGIN
    FOR v_date IN SELECT generate_series('2026-05-01'::date, '2026-05-25'::date, '1 day'::interval)::date
    LOOP
        INSERT INTO employee_schedules (employee_number, shift_code, schedule_date) VALUES
            ('GER-001', 'MATUTINO',   v_date),
            ('COC-001', 'MATUTINO',   v_date),
            ('COC-002', 'MATUTINO',   v_date),
            ('COC-003', 'MATUTINO',   v_date),
            ('BAR-001', 'VESPERTINO', v_date),
            ('CAJ-001', 'MATUTINO',   v_date),
            ('LIM-001', 'MATUTINO',   v_date)
        ON CONFLICT (employee_number, schedule_date) DO NOTHING;
    END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════
-- 14. ASISTENCIAS
-- Mayo 1–23: todos presentes
-- Mayo 24:   HÉCTOR (COC-003) AUSENTE → luego recibe descuento
-- Mayo 25:   todos presentes (incluyendo Héctor que regresó)
--            Sofía (MES-004) no tiene asignación ni asistencia hoy
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_date DATE;
    v_emps TEXT[] := ARRAY['MES-001','MES-002','MES-003','MES-004',
                           'GER-001','COC-001','COC-002','COC-003',
                           'BAR-001','CAJ-001','LIM-001'];
    v_emp  TEXT;
BEGIN
    -- Mayo 1–23: todos presentes
    FOR v_date IN SELECT generate_series('2026-05-01'::date, '2026-05-23'::date, '1 day'::interval)::date
    LOOP
        FOREACH v_emp IN ARRAY v_emps LOOP
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES (v_emp, 'ADMIN', v_date, (v_date + TIME '08:05:00') AT TIME ZONE 'America/Mexico_City')
            ON CONFLICT (employee_number, work_date) DO NOTHING;
        END LOOP;
    END LOOP;

    -- Mayo 24: todos menos COC-003 (Héctor) y MES-004 (Sofía ya trabajó, MES-004 sí trabajó el 24)
    FOREACH v_emp IN ARRAY v_emps LOOP
        IF v_emp <> 'COC-003' THEN
            INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
            VALUES (v_emp, 'ADMIN', '2026-05-24', ('2026-05-24'::date + TIME '08:05:00') AT TIME ZONE 'America/Mexico_City')
            ON CONFLICT (employee_number, work_date) DO NOTHING;
        END IF;
    END LOOP;

    -- Mayo 25 (hoy): todos presentes menos Sofía (MES-004 sin asignación, no se registra)
    FOREACH v_emp IN ARRAY ARRAY['MES-001','MES-002','MES-003',
                                  'GER-001','COC-001','COC-002','COC-003',
                                  'BAR-001','CAJ-001'] LOOP
        INSERT INTO attendance_records (employee_number, source, work_date, check_in_at)
        VALUES (v_emp, 'ADMIN', '2026-05-25', ('2026-05-25'::date + TIME '08:04:00') AT TIME ZONE 'America/Mexico_City')
        ON CONFLICT (employee_number, work_date) DO NOTHING;
    END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════
-- 15. DESCUENTO DE NÓMINA — HÉCTOR (COC-003) — Mayo 24
-- ════════════════════════════════════════════════════════════
INSERT INTO payroll_deductions (employee_number, deduction_date, deduction_type, motivo, applied_by)
VALUES (
    'COC-003',
    '2026-05-24',
    'FALTA_INJUSTIFICADA',
    'El empleado no se presentó a su turno sin aviso previo.',
    'GER-001'
) ON CONFLICT (employee_number, deduction_date) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- 16. ÓRDENES HISTÓRICAS CERRADAS (Mayo 20–24)
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_waiter1  UUID;
    v_waiter2  UUID;
    v_cashier  UUID;
    v_t05 UUID; v_t06 UUID; v_t09 UUID; v_t10 UUID; v_t02 UUID; v_t04 UUID;
    v_ens UUID; v_pec UUID; v_enc UUID; v_tac UUID; v_pul UUID; v_cer_cl UUID;
    v_cer_os UUID; v_agu UUID; v_fil UUID; v_cam UUID;
    v_order_id UUID;
    v_item_id  UUID;
BEGIN
    SELECT id INTO v_waiter1 FROM employees WHERE employee_number = 'MES-001';
    SELECT id INTO v_waiter2 FROM employees WHERE employee_number = 'MES-002';
    SELECT id INTO v_cashier FROM employees WHERE employee_number = 'CAJ-001';

    SELECT id INTO v_t05 FROM restaurant_tables WHERE code = 'T-05';
    SELECT id INTO v_t06 FROM restaurant_tables WHERE code = 'T-06';
    SELECT id INTO v_t09 FROM restaurant_tables WHERE code = 'T-09';
    SELECT id INTO v_t10 FROM restaurant_tables WHERE code = 'T-10';
    SELECT id INTO v_t02 FROM restaurant_tables WHERE code = 'T-02';
    SELECT id INTO v_t04 FROM restaurant_tables WHERE code = 'T-04';

    SELECT id INTO v_ens    FROM menu_dishes WHERE code = 'ENS-CES';
    SELECT id INTO v_pec    FROM menu_dishes WHERE code = 'PEC-PLA';
    SELECT id INTO v_enc    FROM menu_dishes WHERE code = 'ENC-VER';
    SELECT id INTO v_tac    FROM menu_dishes WHERE code = 'TAC-BIS';
    SELECT id INTO v_pul    FROM menu_dishes WHERE code = 'PUL-BRA';
    SELECT id INTO v_cer_cl FROM menu_dishes WHERE code = 'CER-CLA';
    SELECT id INTO v_cer_os FROM menu_dishes WHERE code = 'CER-OSC';
    SELECT id INTO v_agu    FROM menu_dishes WHERE code = 'AGU-MIN';
    SELECT id INTO v_fil    FROM menu_dishes WHERE code = 'FIL-MIG';
    SELECT id INTO v_cam    FROM menu_dishes WHERE code = 'CAM-MOJ';

    -- ── Orden 1: T-05 Mayo 20 ──────────────────────────────
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-DEMO-001', v_t05, v_waiter1, 2, 'CLOSED', 324.00, '2026-05-20 13:10:00+00')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status) VALUES
            (v_order_id, v_ens,    1,  89.00,  89.00, 'DELIVERED'),
            (v_order_id, v_pec,    1, 145.00, 145.00, 'DELIVERED'),
            (v_order_id, v_cer_cl, 2,  45.00,  90.00, 'DELIVERED');
        INSERT INTO payments (order_id, method, amount, tip, cashier_id)
        VALUES (v_order_id, 'CARD', 374.00, 50.00, v_cashier);
        INSERT INTO tickets (folio, order_id, subtotal, tax, tip_total, total)
        VALUES ('TKT-20260520-0001', v_order_id, 324.00, 0.00, 50.00, 374.00)
        ON CONFLICT (folio) DO NOTHING;
    END IF;

    -- ── Orden 2: T-09 Mayo 20 ──────────────────────────────
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-DEMO-002', v_t09, v_waiter2, 4, 'CLOSED', 835.00, '2026-05-20 14:30:00+00')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status) VALUES
            (v_order_id, v_fil,    2, 285.00, 570.00, 'DELIVERED'),
            (v_order_id, v_ens,    1,  89.00,  89.00, 'DELIVERED'),
            (v_order_id, v_cer_os, 2,  55.00, 110.00, 'DELIVERED'),
            (v_order_id, v_agu,    2,  35.00,  70.00, 'DELIVERED') -- corrección al total
            ;
        UPDATE order_headers SET total = 839.00 WHERE id = v_order_id;
        INSERT INTO payments (order_id, method, amount, tip, cashier_id)
        VALUES (v_order_id, 'CASH', 1000.00, 0.00, v_cashier);
        INSERT INTO tickets (folio, order_id, subtotal, tax, tip_total, total)
        VALUES ('TKT-20260520-0002', v_order_id, 839.00, 0.00, 0.00, 839.00)
        ON CONFLICT (folio) DO NOTHING;
    END IF;

    -- ── Orden 3: T-06 Mayo 21 ──────────────────────────────
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-DEMO-003', v_t06, v_waiter1, 3, 'CLOSED', 515.00, '2026-05-21 13:45:00+00')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status) VALUES
            (v_order_id, v_cam,    1, 225.00, 225.00, 'DELIVERED'),
            (v_order_id, v_tac,    1, 165.00, 165.00, 'DELIVERED'),
            (v_order_id, v_cer_cl, 2,  45.00,  90.00, 'DELIVERED'),
            (v_order_id, v_agu,    1,  35.00,  35.00, 'DELIVERED');
        INSERT INTO payments (order_id, method, amount, tip, cashier_id)
        VALUES (v_order_id, 'TRANSFER', 515.00, 0.00, v_cashier);
        INSERT INTO tickets (folio, order_id, subtotal, tax, tip_total, total)
        VALUES ('TKT-20260521-0001', v_order_id, 515.00, 0.00, 0.00, 515.00)
        ON CONFLICT (folio) DO NOTHING;
    END IF;

    -- ── Orden 4: T-10 Mayo 22 ──────────────────────────────
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-DEMO-004', v_t10, v_waiter2, 6, 'CLOSED', 1125.00, '2026-05-22 14:00:00+00')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status) VALUES
            (v_order_id, v_fil,    2, 285.00, 570.00, 'DELIVERED'),
            (v_order_id, v_pul,    1, 265.00, 265.00, 'DELIVERED'),
            (v_order_id, v_ens,    2,  89.00, 178.00, 'DELIVERED'),
            (v_order_id, v_cer_os, 2,  55.00, 110.00, 'DELIVERED');
        INSERT INTO payments (order_id, method, amount, tip, cashier_id)
        VALUES (v_order_id, 'CARD', 1225.00, 100.00, v_cashier);
        INSERT INTO tickets (folio, order_id, subtotal, tax, tip_total, total)
        VALUES ('TKT-20260522-0001', v_order_id, 1123.00, 0.00, 100.00, 1223.00)
        ON CONFLICT (folio) DO NOTHING;
    END IF;

    -- ── Orden 5: T-02 Mayo 23 ──────────────────────────────
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-DEMO-005', v_t02, v_waiter1, 2, 'CLOSED', 290.00, '2026-05-23 13:20:00+00')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status) VALUES
            (v_order_id, v_enc,    1, 125.00, 125.00, 'DELIVERED'),
            (v_order_id, v_tac,    1, 165.00, 165.00, 'DELIVERED');
        INSERT INTO payments (order_id, method, amount, tip, cashier_id)
        VALUES (v_order_id, 'CASH', 300.00, 10.00, v_cashier);
        INSERT INTO tickets (folio, order_id, subtotal, tax, tip_total, total)
        VALUES ('TKT-20260523-0001', v_order_id, 290.00, 0.00, 10.00, 300.00)
        ON CONFLICT (folio) DO NOTHING;
    END IF;

    -- ── Orden 6: T-04 Mayo 24 ──────────────────────────────
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-DEMO-006', v_t04, v_waiter2, 1, 'CLOSED', 200.00, '2026-05-24 14:10:00+00')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status) VALUES
            (v_order_id, v_pul,    1, 265.00, 265.00, 'DELIVERED'), -- ajuste de total abajo
            (v_order_id, v_cer_os, 1,  55.00,  55.00, 'DELIVERED');
        UPDATE order_headers SET total = 320.00 WHERE id = v_order_id;
        INSERT INTO payments (order_id, method, amount, tip, cashier_id)
        VALUES (v_order_id, 'CARD', 320.00, 0.00, v_cashier);
        INSERT INTO tickets (folio, order_id, subtotal, tax, tip_total, total)
        VALUES ('TKT-20260524-0001', v_order_id, 320.00, 0.00, 0.00, 320.00)
        ON CONFLICT (folio) DO NOTHING;
    END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- 17. PEDIDOS DE COMPRA HISTÓRICOS (RECEIVED)
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_prov_carnicos UUID;
    v_prov_abarrotes UUID;
    v_prov_bebidas UUID;
    v_po_id UUID;
BEGIN
    SELECT id INTO v_prov_carnicos  FROM suppliers WHERE code = 'PROV-CARNICOS';
    SELECT id INTO v_prov_abarrotes FROM suppliers WHERE code = 'PROV-ABARROTES';
    SELECT id INTO v_prov_bebidas   FROM suppliers WHERE code = 'PROV-BEBIDAS';

    -- PO Mayo 10 — Carnes (RECEIVED)
    SELECT id INTO v_po_id FROM purchase_orders
    WHERE notes = 'Pedido regular de proteínas — semana del 11 Mayo' LIMIT 1;
    IF v_po_id IS NULL THEN
        INSERT INTO purchase_orders (supplier_id, status, total_amount, notes, generated_at)
        VALUES (v_prov_carnicos, 'RECEIVED', 14195.00, 'Pedido regular de proteínas — semana del 11 Mayo', '2026-05-08 10:00:00+00')
        RETURNING id INTO v_po_id;
        INSERT INTO purchase_order_items (order_id, item_id, supplier_id, origin, qty_suggested, qty_delivered, unit_price, lead_time_days) VALUES
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-POLLO'),   v_prov_carnicos, 'ADMIN', 20000, 20000,  85.00, 1),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-RES'),     v_prov_carnicos, 'ADMIN', 12000, 12000, 130.00, 1),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-CERDO'),   v_prov_carnicos, 'ADMIN',  6000,  6000,  95.00, 1),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-CAMARON'), v_prov_carnicos, 'ADMIN',  5000,  5000, 185.00, 1)
        ON CONFLICT (order_id, item_id) DO NOTHING;
    END IF;

    -- PO Mayo 15 — Abarrotes (RECEIVED)
    SELECT id INTO v_po_id FROM purchase_orders
    WHERE notes = 'Reabasto semanal de abarrotes' LIMIT 1;
    IF v_po_id IS NULL THEN
        INSERT INTO purchase_orders (supplier_id, status, total_amount, notes, generated_at)
        VALUES (v_prov_abarrotes, 'RECEIVED', 9535.00, 'Reabasto semanal de abarrotes', '2026-05-13 09:00:00+00')
        RETURNING id INTO v_po_id;
        INSERT INTO purchase_order_items (order_id, item_id, supplier_id, origin, qty_suggested, qty_delivered, unit_price, lead_time_days) VALUES
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-ACEITE'),   v_prov_abarrotes, 'ADMIN', 15000, 15000,  32.00, 3),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-TORTILLA'), v_prov_abarrotes, 'ADMIN',   300,   300,   0.80, 2),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-ARROZ'),    v_prov_abarrotes, 'ADMIN', 15000, 15000,  22.00, 3),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-FRIJOL'),   v_prov_abarrotes, 'ADMIN', 10000, 10000,  35.00, 3)
        ON CONFLICT (order_id, item_id) DO NOTHING;
    END IF;

    -- PO Mayo 20 — Bebidas (RECEIVED)
    SELECT id INTO v_po_id FROM purchase_orders
    WHERE notes = 'Pedido quincenal de bebidas y refrescos' LIMIT 1;
    IF v_po_id IS NULL THEN
        INSERT INTO purchase_orders (supplier_id, status, total_amount, notes, generated_at)
        VALUES (v_prov_bebidas, 'RECEIVED', 77700.00, 'Pedido quincenal de bebidas y refrescos', '2026-05-18 11:00:00+00')
        RETURNING id INTO v_po_id;
        INSERT INTO purchase_order_items (order_id, item_id, supplier_id, origin, qty_suggested, qty_delivered, unit_price, lead_time_days) VALUES
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-CERV-CL'),  v_prov_bebidas, 'ADMIN', 168, 168, 420.00, 2),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-CERV-OS'),  v_prov_bebidas, 'ADMIN', 120, 120, 480.00, 2),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-REFRESCO'), v_prov_bebidas, 'ADMIN', 192, 192, 320.00, 2),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-AGUA'),     v_prov_bebidas, 'ADMIN',  72,  72,  18.00, 2)
        ON CONFLICT (order_id, item_id) DO NOTHING;
    END IF;

    -- PO Mayo 25 — Pulpo + Pollo fresco (RECEIVED, entregado esta mañana)
    SELECT id INTO v_po_id FROM purchase_orders
    WHERE notes = 'Pulpo fresco y pollo para el día' LIMIT 1;
    IF v_po_id IS NULL THEN
        INSERT INTO purchase_orders (supplier_id, status, total_amount, notes, generated_at)
        VALUES (v_prov_carnicos, 'RECEIVED', 2190.00, 'Pulpo fresco y pollo para el día', '2026-05-24 17:00:00+00')
        RETURNING id INTO v_po_id;
        INSERT INTO purchase_order_items (order_id, item_id, supplier_id, origin, qty_suggested, qty_delivered, unit_price, lead_time_days) VALUES
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-PULPO'),   v_prov_carnicos, 'ADMIN', 8000, 8000, 210.00, 1),
            (v_po_id, (SELECT id FROM inventory_items WHERE code='INS-POLLO'),   v_prov_carnicos, 'ADMIN', 6000, 6000,  85.00, 1)
        ON CONFLICT (order_id, item_id) DO NOTHING;
    END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- 18. ÓRDENES ACTIVAS DE HOY (2026-05-25) — 4 escenarios del pipeline
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_mes001  UUID;
    v_mes002  UUID;
    v_t01 UUID; v_t03 UUID; v_t07 UUID; v_t08 UUID;
    v_ens_id UUID; v_pec_id UUID; v_enc_id UUID; v_tac_id UUID;
    v_cer_cl_id UUID; v_cer_os_id UUID; v_agu_id UUID; v_ref_id UUID;
    v_fil_id UUID;
    v_ord_a UUID; v_ord_b UUID; v_ord_c UUID; v_ord_d UUID;
    v_cashier UUID;
BEGIN
    SELECT id INTO v_mes001 FROM employees WHERE employee_number = 'MES-001';
    SELECT id INTO v_mes002 FROM employees WHERE employee_number = 'MES-002';
    SELECT id INTO v_cashier FROM employees WHERE employee_number = 'CAJ-001';

    SELECT id INTO v_t01 FROM restaurant_tables WHERE code = 'T-01';
    SELECT id INTO v_t03 FROM restaurant_tables WHERE code = 'T-03';
    SELECT id INTO v_t07 FROM restaurant_tables WHERE code = 'T-07';
    SELECT id INTO v_t08 FROM restaurant_tables WHERE code = 'T-08';

    SELECT id INTO v_ens_id    FROM menu_dishes WHERE code = 'ENS-CES';
    SELECT id INTO v_pec_id    FROM menu_dishes WHERE code = 'PEC-PLA';
    SELECT id INTO v_enc_id    FROM menu_dishes WHERE code = 'ENC-VER';
    SELECT id INTO v_tac_id    FROM menu_dishes WHERE code = 'TAC-BIS';
    SELECT id INTO v_fil_id    FROM menu_dishes WHERE code = 'FIL-MIG';
    SELECT id INTO v_cer_cl_id FROM menu_dishes WHERE code = 'CER-CLA';
    SELECT id INTO v_cer_os_id FROM menu_dishes WHERE code = 'CER-OSC';
    SELECT id INTO v_agu_id    FROM menu_dishes WHERE code = 'AGU-MIN';
    SELECT id INTO v_ref_id    FROM menu_dishes WHERE code = 'REF-LAT';

    -- ── Orden A: T-01 — OPEN — recién enviada a cocina ─────────
    -- Ensalada y Pechuga → PENDING_KITCHEN (esperando en KDS)
    -- Cerveza Clara → PENDING_FLOOR (mesero recoge de barra)
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-ACTIVA-001', v_t01, v_mes001, 2, 'OPEN', 279.00, NOW() - INTERVAL '8 minutes')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_ord_a;

    IF v_ord_a IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status, created_at) VALUES
            (v_ord_a, v_ens_id,    1,  89.00,  89.00, 'PENDING_KITCHEN', NOW() - INTERVAL '8 minutes'),
            (v_ord_a, v_pec_id,    1, 145.00, 145.00, 'PENDING_KITCHEN', NOW() - INTERVAL '8 minutes'),
            (v_ord_a, v_cer_cl_id, 1,  45.00,  45.00, 'PENDING_FLOOR',   NOW() - INTERVAL '8 minutes');
    END IF;

    -- ── Orden B: T-07 — OPEN — cocina trabajando ───────────────
    -- Filete → PREPARING (cook arrancó)
    -- Agua → PENDING_FLOOR (mesero recoge de barra)
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-ACTIVA-002', v_t07, v_mes002, 2, 'OPEN', 320.00, NOW() - INTERVAL '22 minutes')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_ord_b;

    IF v_ord_b IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status, started_at, created_at) VALUES
            (v_ord_b, v_fil_id, 1, 285.00, 285.00, 'PREPARING', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '22 minutes'),
            (v_ord_b, v_agu_id, 1,  35.00,  35.00, 'PENDING_FLOOR', NULL, NOW() - INTERVAL '22 minutes');
    END IF;

    -- ── Orden C: T-03 — OPEN — listos para servir ──────────────
    -- Tacos → READY (esperando que mesero los lleve)
    -- Refresco → PENDING_FLOOR (barra los tiene listos)
    -- Ensalada → DELIVERED (ya está en la mesa)
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-ACTIVA-003', v_t03, v_mes001, 3, 'OPEN', 294.00, NOW() - INTERVAL '35 minutes')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_ord_c;

    IF v_ord_c IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status, created_at) VALUES
            (v_ord_c, v_tac_id, 1, 165.00, 165.00, 'READY',         NOW() - INTERVAL '35 minutes'),
            (v_ord_c, v_ref_id, 1,  40.00,  40.00, 'PENDING_FLOOR', NOW() - INTERVAL '35 minutes'),
            (v_ord_c, v_ens_id, 1,  89.00,  89.00, 'DELIVERED',     NOW() - INTERVAL '35 minutes');
    END IF;

    -- ── Orden D: T-08 — AWAITING_PAYMENT — ciclo casi completo ─
    -- Todo entregado, cliente espera su cuenta
    INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total, created_at)
    VALUES ('ORD-ACTIVA-004', v_t08, v_mes002, 2, 'AWAITING_PAYMENT', 180.00, NOW() - INTERVAL '55 minutes')
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_ord_d;

    IF v_ord_d IS NOT NULL THEN
        INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status, created_at) VALUES
            (v_ord_d, v_enc_id,    1, 125.00, 125.00, 'DELIVERED', NOW() - INTERVAL '55 minutes'),
            (v_ord_d, v_cer_os_id, 1,  55.00,  55.00, 'DELIVERED', NOW() - INTERVAL '55 minutes');
    END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- 19. LLAMADA DE MESERO PENDIENTE (T-05)
-- ════════════════════════════════════════════════════════════
INSERT INTO waiter_calls (table_id, reason, status)
SELECT (SELECT id FROM restaurant_tables WHERE code = 'T-05'), 'ASSISTANCE', 'PENDING'
WHERE NOT EXISTS (
    SELECT 1 FROM waiter_calls
    WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'T-05')
      AND status = 'PENDING'
);


-- ════════════════════════════════════════════════════════════
-- 20. GENERAR SUGERENCIAS AUTOMÁTICAS DE COMPRA
-- Detectará INS-QUESO, INS-CREMA, INS-LIMON con stock bajo
-- y creará purchase_orders DRAFT por PROV-LACTEOS y PROV-VERDURAS.
-- ════════════════════════════════════════════════════════════
CALL sp_generate_purchase_suggestions();
