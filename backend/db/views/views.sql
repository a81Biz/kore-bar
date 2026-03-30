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
    d.can_pickup,
    d.has_recipe,
    d.preparation_method
FROM menu_dishes d
JOIN menu_categories c ON d.category_id = c.id
ORDER BY c.name, d.name;



-- ── INVENTARIO ────────────────────────────────────────────────

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


-- ── MESEROS ───────────────────────────────────────────────────
-- Crítico #6: reemplaza la query raw con JOINs en waiter.model.js

CREATE OR REPLACE VIEW vw_waiter_floor_layout AS
SELECT
    z.code        AS zone_code,
    z.name        AS zone_name,
    t.code        AS table_code,
    t.capacity,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM order_headers
            WHERE table_id = t.id AND status = 'OPEN'
        ) THEN 'OCCUPIED'
        WHEN EXISTS (
            SELECT 1 FROM order_headers
            WHERE table_id = t.id AND status = 'AWAITING_PAYMENT'
        ) THEN 'AWAITING_PAYMENT'
        ELSE 'AVAILABLE'
    END AS status,
    (
        SELECT e.first_name
        FROM order_headers oh
        JOIN employees e ON e.id = oh.waiter_id
        WHERE oh.table_id = t.id
          AND oh.status IN ('OPEN', 'AWAITING_PAYMENT')
        ORDER BY oh.created_at DESC
        LIMIT 1
    ) AS waiter_name
FROM restaurant_zones z
JOIN restaurant_tables t ON t.zone_id = z.id AND t.is_active = true
WHERE z.is_active = true
ORDER BY z.name, t.code;


-- ── ORDEN ITEMS (detalle) ─────────────────────────────────────
-- Crítico #6: reemplaza la query raw con JOIN en waiter.model.js

CREATE OR REPLACE VIEW vw_order_items_detail AS
SELECT
    oi.id,
    oi.order_id,
    md.code      AS dish_code,
    md.name,
    oi.quantity,
    oi.unit_price,
    oi.subtotal,
    oi.status,
    md.has_recipe,
    oi.created_at
FROM order_items oi
JOIN menu_dishes md ON oi.dish_id = md.id;


-- ── CAJA — EMPLEADOS ELEGIBLES ────────────────────────────────
-- Crítico #6: reemplaza la query raw con JOINs en cashier.model.js

CREATE OR REPLACE VIEW vw_cashier_eligible_employees AS
SELECT DISTINCT
    e.employee_number,
    e.first_name,
    e.last_name
FROM employees e
JOIN positions pos ON pos.id = e.position_id AND pos.is_active = true
JOIN areas a       ON a.id = pos.area_id AND a.can_access_cashier = true
WHERE e.is_active = true
ORDER BY e.first_name, e.last_name;


CREATE OR REPLACE VIEW vw_floor_stock AS
SELECT 
    mc.name                               AS "categoryName",
    mc.code                               AS "categoryCode",
    mc.route_to_kds                       AS "routeToKds",
    md.code                               AS "dishCode",
    md.name                               AS "name",
    md.price,
    md.image_url                          AS "imageUrl",
    md.has_recipe                         AS "hasRecipe",
    md.can_pickup                         AS "canPickup",
    md.is_active                          AS "isActive",
    COALESCE(SUM(isl.stock), 99)::numeric AS "stock_available"
FROM menu_dishes md
JOIN menu_categories mc ON md.category_id = mc.id
LEFT JOIN inventory_items ii ON ii.code = md.code
LEFT JOIN inventory_stock_locations isl ON isl.item_id = ii.id
LEFT JOIN inventory_locations il ON il.id = isl.location_id AND il.code = 'LOC-PISO'
WHERE md.is_active = true
  AND mc.is_active = true
  AND (md.has_recipe = true OR md.can_pickup = true)
GROUP BY 
    mc.name, mc.code, mc.route_to_kds, 
    md.code, md.name, md.price, md.image_url, 
    md.has_recipe, md.can_pickup, md.is_active
ORDER BY mc.name ASC, md.name ASC;