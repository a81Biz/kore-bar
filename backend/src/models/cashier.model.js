import { executeQuery } from '../db/connection.js';

export const getCashierEmployees = async (c) =>
    await executeQuery(c, `
        SELECT DISTINCT e.employee_number, e.first_name, e.last_name
        FROM employees e
        JOIN positions pos ON pos.id = e.position_id AND pos.is_active = true
        JOIN areas a       ON a.id = pos.area_id AND a.can_access_cashier = true
        WHERE e.is_active = true
        ORDER BY e.first_name, e.last_name
    `);

export const validateCashierPin = async (c, employeeNumber, pin) =>
    await executeQuery(c, `
        SELECT e.id, e.first_name, e.last_name, e.is_active
        FROM employees e
        WHERE e.employee_number = $1 AND e.pin_code = $2
    `, [employeeNumber || null, pin || null]);

export const permissionQuery = async (c) =>
    await executeQuery(c, `
        SELECT COUNT(*) AS total_areas_with_permission
        FROM areas
        WHERE can_access_cashier = true AND is_active = true
    `);

export const empPermQuery = async (c, employeeId) =>
    await executeQuery(c, `
        SELECT 1
        FROM employees e
        JOIN positions pos ON pos.id = e.position_id AND pos.is_active = true
        JOIN areas a       ON a.id = pos.area_id AND a.can_access_cashier = true AND a.is_active = true
        WHERE e.id = $1
        LIMIT 1
    `, [employeeId || null]);

// Usa vw_cashier_board — fuente única de verdad para el tablero de caja
export const getCashierBoard = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_cashier_board`);

export const cashierProcessPayment = async (c, spPayload) =>
    await executeQuery(c, `CALL public.sp_cashier_process_payment($1::JSONB)`, [spPayload]);

export const ticketQuery = async (c, tableCode) =>
    await executeQuery(c, `
        SELECT t.folio, t.total
        FROM tickets t
        JOIN order_headers oh     ON oh.id = t.order_id
        JOIN restaurant_tables rt ON rt.id = oh.table_id
        WHERE rt.code = $1
          AND oh.status = 'CLOSED'
        ORDER BY t.created_at DESC
        LIMIT 1
    `, [tableCode]);

export const getTicketByFolio = async (c, folio) =>
    await executeQuery(c, `
        SELECT t.folio, t.subtotal, t.tax, t.tip_total, t.total,
               t.is_invoiced, t.created_at,
               rt.code AS table_code,
               rz.name AS zone_name
        FROM tickets t
        JOIN order_headers oh     ON oh.id = t.order_id
        JOIN restaurant_tables rt ON rt.id = oh.table_id
        JOIN restaurant_zones rz  ON rz.id = rt.zone_id
        WHERE t.folio = $1
    `, [folio || null]);

export const itemsQuery = async (c, folio) =>
    await executeQuery(c, `
        SELECT md.name, oi.quantity, oi.unit_price, oi.subtotal
        FROM tickets t
        JOIN order_headers oh ON oh.id = t.order_id
        JOIN order_items oi   ON oi.order_id = oh.id
        JOIN menu_dishes md   ON md.id = oi.dish_id
        WHERE t.folio = $1
        ORDER BY oi.created_at ASC
    `, [folio || null]);

// Usa vw_cashier_corte — fuente única de verdad para el corte Z
export const getCashierCorte = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_cashier_corte`);

// JOIN con order_headers para dejar explícito que solo se cuentan
// tickets de órdenes cerradas (garantizado por el SP, pero más legible así)
export const totalsQuery = async (c) =>
    await executeQuery(c, `
        SELECT COUNT(*)         AS total_tickets,
               SUM(t.total)     AS grand_total,
               SUM(t.tip_total) AS grand_tips
        FROM tickets t
        JOIN order_headers oh ON oh.id = t.order_id
        WHERE oh.status = 'CLOSED'
          AND DATE(t.created_at AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE
    `);