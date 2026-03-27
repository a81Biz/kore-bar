-- ============================================================
-- vw_dashboard_kpis
-- KPIs agregados en tiempo real para el dashboard de admin
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_kpis AS
SELECT
    -- Piso
    (SELECT COUNT(*) FROM restaurant_zones WHERE is_active = true)   AS active_zones,
    (SELECT COUNT(*) FROM restaurant_tables WHERE is_active = true)  AS active_tables,
    (SELECT COALESCE(SUM(capacity), 0) FROM restaurant_tables WHERE is_active = true) AS total_capacity,

    -- Personal
    (SELECT COUNT(*) FROM employees WHERE is_active = true)          AS active_employees,
    (SELECT COUNT(*) FROM employees e
     JOIN positions p ON e.position_id = p.id
     JOIN job_titles jt ON p.job_title_id = jt.id
     WHERE e.is_active = true AND jt.code IN ('04', '05'))           AS active_waiters,

    -- Menú
    (SELECT COUNT(*) FROM menu_categories WHERE is_active = true)    AS active_categories,
    (SELECT COUNT(*) FROM menu_dishes WHERE is_active = true)        AS active_dishes,

    -- Inventario
    (SELECT COUNT(*) FROM suppliers WHERE is_active = true)          AS active_suppliers,
    (SELECT COUNT(*) FROM inventory_items WHERE is_active = true)    AS active_items,
    (SELECT COUNT(*) FROM inventory_items
     WHERE is_active = true AND current_stock <= minimum_stock)      AS items_below_minimum,

    -- Ventas del día
    (SELECT COUNT(t.id) FROM tickets t
     JOIN order_headers oh ON t.order_id = oh.id
     WHERE oh.status = 'CLOSED' AND DATE(t.created_at) = CURRENT_DATE)       AS today_tickets,
    (SELECT COALESCE(SUM(t.total), 0) FROM tickets t
     JOIN order_headers oh ON t.order_id = oh.id
     WHERE oh.status = 'CLOSED' AND DATE(t.created_at) = CURRENT_DATE)       AS today_revenue,
    (SELECT COALESCE(SUM(t.tip_total), 0) FROM tickets t
     JOIN order_headers oh ON t.order_id = oh.id
     WHERE oh.status = 'CLOSED' AND DATE(t.created_at) = CURRENT_DATE)       AS today_tips,

    -- Órdenes activas
    (SELECT COUNT(*) FROM order_headers WHERE status = 'OPEN')       AS open_orders,
    (SELECT COUNT(*) FROM order_headers WHERE status = 'AWAITING_PAYMENT') AS awaiting_payment;
