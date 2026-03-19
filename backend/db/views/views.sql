-- ============================================================
-- views.sql
-- Vistas de negocio (capa de reporting / consulta)
-- Dependencias: todos los módulos de migrations/
-- ============================================================

-- ── RRHH ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_directory_employees AS
SELECT
    e.employee_number,
    e.first_name,
    e.last_name,
    jt.name  AS job_title_name,
    jt.code  AS job_title_code,
    a.name   AS area_name,
    a.code   AS area_code,
    p.code   AS position_code,
    e.hire_date,
    e.is_active,
    r.name   AS system_role
FROM employees e
LEFT JOIN positions p   ON e.position_id = p.id
LEFT JOIN job_titles jt ON p.job_title_id = jt.id
LEFT JOIN areas a       ON p.area_id = a.id
LEFT JOIN system_users su ON e.employee_number = su.employee_number
LEFT JOIN roles r       ON su.role_id = r.id
ORDER BY e.created_at DESC;

CREATE OR REPLACE VIEW vw_dictionary_positions AS
SELECT
    p.code  AS position_code,
    jt.code AS job_title_code,
    jt.name AS job_title_name,
    a.code  AS area_code,
    a.name  AS area_name
FROM positions p
JOIN job_titles jt ON p.job_title_id = jt.id
JOIN areas a       ON p.area_id = a.id
ORDER BY a.code, jt.name ASC;

-- ── MENÚ ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_menu_dishes AS
SELECT
    d.code   AS dish_code,
    c.code   AS category_code,
    c.name   AS category_name,
    d.name,
    d.description,
    d.price,
    d.image_url,
    d.is_active,
    d.has_recipe,
    d.preparation_method
FROM menu_dishes d
JOIN menu_categories c ON d.category_id = c.id
ORDER BY c.name, d.name;

-- ── INVENTARIO ───────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_suppliers_with_prices AS
SELECT
    s.code,
    s.name,
    s.contact_info AS "contactName",
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'itemCode', i.code,
                'itemName', i.name,
                'itemUnit', i.unit_measure,
                'price',    sp.price
            )
        ) FILTER (WHERE sp.item_id IS NOT NULL),
        '[]'::jsonb
    ) AS prices
FROM suppliers s
LEFT JOIN supplier_prices sp ON s.id = sp.supplier_id
LEFT JOIN inventory_items i  ON sp.item_id = i.id
GROUP BY s.id, s.code, s.name, s.contact_info;

-- Stock consolidado por insumo (suma de todas las ubicaciones)
CREATE OR REPLACE VIEW vw_stock_summary AS
SELECT
    ii.code,
    ii.name,
    ii.unit_measure,
    ii.recipe_unit,
    ii.minimum_stock,
    COALESCE(SUM(sl.stock), 0) AS total_stock,
    jsonb_agg(
        jsonb_build_object(
            'location', il.name,
            'type',     il.type,
            'stock',    sl.stock
        )
    ) FILTER (WHERE sl.item_id IS NOT NULL) AS by_location
FROM inventory_items ii
LEFT JOIN inventory_stock_locations sl ON sl.item_id = ii.id
LEFT JOIN inventory_locations il       ON il.id = sl.location_id
WHERE ii.is_active = true
GROUP BY ii.id, ii.code, ii.name, ii.unit_measure, ii.recipe_unit, ii.minimum_stock
ORDER BY ii.name;

-- ── CAJA ─────────────────────────────────────────────────────

-- Tablero en tiempo real: órdenes esperando pago
CREATE OR REPLACE VIEW vw_cashier_board AS
SELECT
    rt.code        AS table_code,
    rz.name        AS zone_name,
    oh.code        AS order_code,
    oh.total,
    oh.updated_at  AS waiting_since,
    e.first_name   AS waiter_first_name,
    e.last_name    AS waiter_last_name
FROM order_headers oh
JOIN restaurant_tables rt  ON rt.id = oh.table_id
JOIN restaurant_zones rz   ON rz.id = rt.zone_id
JOIN employees e           ON e.id  = oh.waiter_id
WHERE oh.status = 'AWAITING_PAYMENT'
ORDER BY oh.updated_at ASC;

-- Corte Z del día (agrupado por método de pago)
CREATE OR REPLACE VIEW vw_cashier_corte AS
SELECT
    p.method,
    COUNT(DISTINCT oh.id)  AS transactions,
    SUM(p.amount)          AS total_collected,
    SUM(p.tip)             AS total_tips
FROM payments p
JOIN order_headers oh ON oh.id = p.order_id
WHERE oh.status = 'CLOSED'
  AND DATE(p.created_at AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE
GROUP BY p.method
ORDER BY p.method;
