// ============================================================
// admin-reports.model.js
// Modelo: Reportes de ventas y KPIs del dashboard
// Convención: Solo mapeo de variables + invocación a vistas/funciones
// ============================================================
import { executeQuery } from '../db/connection.js';

export const getSalesReport = async (c, { startDate, endDate }) => {
    return await executeQuery(c,
        `SELECT * FROM vw_sales_report
         WHERE sale_date >= $1 AND sale_date <= $2
         ORDER BY ticket_date DESC`,
        [startDate, endDate]
    );
};

export const getSalesSummary = async (c, { startDate, endDate }) => {
    return await executeQuery(c,
        `SELECT * FROM vw_sales_summary
         WHERE sale_date >= $1 AND sale_date <= $2
         ORDER BY sale_date ASC`,
        [startDate, endDate]
    );
};

export const getTopDishes = async (c, { startDate, endDate, limit }) => {
    const queryLimit = parseInt(limit) || 10;
    return await executeQuery(c,
        `SELECT dish_code, dish_name, category_name, current_price,
                SUM(times_ordered) AS times_ordered,
                SUM(total_quantity) AS total_quantity,
                SUM(total_revenue) AS total_revenue
         FROM vw_top_dishes
         WHERE sale_date >= $1 AND sale_date <= $2
         GROUP BY dish_code, dish_name, category_name, current_price
         ORDER BY total_quantity DESC
         LIMIT $3`,
        [startDate, endDate, queryLimit]
    );
};

export const getSalesByCategory = async (c, { startDate, endDate }) => {
    return await executeQuery(c,
        `SELECT category_code, category_name,
                SUM(items_sold) AS items_sold,
                SUM(revenue) AS revenue
         FROM vw_sales_by_category
         WHERE sale_date >= $1 AND sale_date <= $2
         GROUP BY category_code, category_name
         ORDER BY revenue DESC`,
        [startDate, endDate]
    );
};

export const getSalesByWaiter = async (c, { startDate, endDate }) => {
    return await executeQuery(c,
        `SELECT waiter_number, waiter_name,
                SUM(tickets_closed) AS tickets_closed,
                SUM(total_revenue) AS total_revenue,
                SUM(total_tips) AS total_tips,
                AVG(avg_ticket) AS avg_ticket
         FROM vw_sales_by_waiter
         WHERE sale_date >= $1 AND sale_date <= $2
         GROUP BY waiter_number, waiter_name
         ORDER BY total_revenue DESC`,
        [startDate, endDate]
    );
};

export const getDashboardKpis = async (c) => {
    const rows = await executeQuery(c, `SELECT * FROM vw_dashboard_kpis`);
    return rows[0] || {};
};
