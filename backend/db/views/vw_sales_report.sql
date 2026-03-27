-- ============================================================
-- vw_sales_report
-- Vista de reporte histórico de ventas por periodo
-- Cruza: tickets × order_headers × order_items × restaurant_tables × employees
-- ============================================================

CREATE OR REPLACE VIEW vw_sales_report AS
SELECT
    t.id                                        AS ticket_id,
    t.folio                                     AS ticket_folio,
    t.created_at                                AS ticket_date,
    t.total                                     AS ticket_total,
    t.tax                                       AS ticket_tax,
    t.subtotal                                  AS ticket_subtotal,
    t.tip_total                                 AS ticket_tip,
    (SELECT STRING_AGG(DISTINCT method, ', ') FROM payments p WHERE p.order_id = oh.id) AS payment_method,
    oh.id                                       AS order_id,
    oh.code                                     AS order_code,
    oh.status                                   AS order_status,
    rt.code                                     AS table_code,
    rt.capacity                                 AS table_capacity,
    rz.code                                     AS zone_code,
    rz.name                                     AS zone_name,
    e.employee_number                           AS waiter_number,
    CONCAT(e.first_name, ' ', e.last_name)      AS waiter_name,
    oi.id                                       AS item_id,
    md.code                                     AS dish_code,
    md.name                                     AS dish_name,
    mc.name                                     AS category_name,
    oi.quantity                                 AS item_quantity,
    oi.unit_price                               AS item_unit_price,
    (oi.quantity * oi.unit_price)               AS item_total,
    oi.status                                   AS item_status,
    oi.created_at                               AS item_ordered_at,
    oi.started_at                               AS item_started_at,
    DATE(t.created_at)                          AS sale_date,
    EXTRACT(HOUR FROM t.created_at)             AS sale_hour,
    EXTRACT(DOW FROM t.created_at)              AS sale_day_of_week
FROM tickets t
JOIN order_headers oh  ON t.order_id        = oh.id
JOIN order_items oi    ON oi.order_id       = oh.id
JOIN menu_dishes md    ON oi.dish_id        = md.id
JOIN menu_categories mc ON md.category_id   = mc.id
LEFT JOIN restaurant_tables rt ON oh.table_id = rt.id
LEFT JOIN restaurant_zones rz  ON rt.zone_id  = rz.id
LEFT JOIN employees e          ON oh.waiter_id = e.id
WHERE oh.status = 'CLOSED'
ORDER BY t.created_at DESC;

-- ============================================================
-- vw_sales_summary
-- Resumen agregado por día para gráficas del dashboard
-- ============================================================

CREATE OR REPLACE VIEW vw_sales_summary AS
SELECT
    DATE(t.created_at)                          AS sale_date,
    COUNT(DISTINCT t.id)                        AS total_tickets,
    COUNT(oi.id)                                AS total_items_sold,
    COALESCE(SUM(t.total), 0)                   AS total_revenue,
    COALESCE(SUM(t.tax), 0)                     AS total_tax,
    COALESCE(SUM(t.tip_total), 0)               AS total_tips,
    COALESCE(AVG(t.total), 0)                   AS avg_ticket,
    COUNT(DISTINCT oh.table_id)                 AS tables_served
FROM tickets t
JOIN order_headers oh ON t.order_id = oh.id
JOIN order_items oi   ON oi.order_id = oh.id
WHERE oh.status = 'CLOSED'
GROUP BY DATE(t.created_at)
ORDER BY sale_date DESC;

-- ============================================================
-- vw_sales_by_category
-- Ventas agregadas por categoría para análisis de menú
-- ============================================================

CREATE OR REPLACE VIEW vw_sales_by_category AS
SELECT
    mc.code                                     AS category_code,
    mc.name                                     AS category_name,
    COUNT(oi.id)                                AS items_sold,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
    DATE(t.created_at)                          AS sale_date
FROM tickets t
JOIN order_headers oh  ON t.order_id      = oh.id
JOIN order_items oi    ON oi.order_id     = oh.id
JOIN menu_dishes md    ON oi.dish_id      = md.id
JOIN menu_categories mc ON md.category_id = mc.id
WHERE oh.status = 'CLOSED'
GROUP BY mc.code, mc.name, DATE(t.created_at)
ORDER BY revenue DESC;

-- ============================================================
-- vw_top_dishes
-- Platillos más vendidos con ranking
-- ============================================================

CREATE OR REPLACE VIEW vw_top_dishes AS
SELECT
    md.code                                     AS dish_code,
    md.name                                     AS dish_name,
    mc.name                                     AS category_name,
    md.price                                    AS current_price,
    COUNT(oi.id)                                AS times_ordered,
    COALESCE(SUM(oi.quantity), 0)               AS total_quantity,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue,
    DATE(t.created_at)                          AS sale_date
FROM tickets t
JOIN order_headers oh  ON t.order_id      = oh.id
JOIN order_items oi    ON oi.order_id     = oh.id
JOIN menu_dishes md    ON oi.dish_id      = md.id
JOIN menu_categories mc ON md.category_id = mc.id
WHERE oh.status = 'CLOSED'
GROUP BY md.code, md.name, mc.name, md.price, DATE(t.created_at)
ORDER BY total_quantity DESC;

-- ============================================================
-- vw_sales_by_waiter
-- Rendimiento por mesero
-- ============================================================

CREATE OR REPLACE VIEW vw_sales_by_waiter AS
SELECT
    e.employee_number                           AS waiter_number,
    CONCAT(e.first_name, ' ', e.last_name)      AS waiter_name,
    COUNT(DISTINCT t.id)                        AS tickets_closed,
    COALESCE(SUM(t.total), 0)                   AS total_revenue,
    COALESCE(SUM(t.tip_total), 0)               AS total_tips,
    COALESCE(AVG(t.total), 0)                   AS avg_ticket,
    DATE(t.created_at)                          AS sale_date
FROM tickets t
JOIN order_headers oh ON t.order_id  = oh.id
JOIN employees e      ON oh.waiter_id = e.id
WHERE oh.status = 'CLOSED'
GROUP BY e.employee_number, e.first_name, e.last_name, DATE(t.created_at)
ORDER BY total_revenue DESC;
