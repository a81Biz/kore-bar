import { executeQuery } from '../db/connection.js';

export const validatePin = async (c, employeeNumber, pin) =>
    await executeQuery(c, `
        SELECT id, first_name, last_name, is_active
        FROM employees
        WHERE employee_number = $1 AND pin_code = $2
    `, [employeeNumber, pin]);

export const getLayout = async (c) =>
    await executeQuery(c, `
        SELECT
            z.code  AS zone_code,
            z.name  AS zone_name,
            t.code  AS table_code,
            t.capacity,
            CASE
                WHEN oh.id IS NOT NULL THEN 'OCCUPIED'
                ELSE 'AVAILABLE'
            END AS status,
            e.first_name AS waiter_name
        FROM restaurant_zones z
        JOIN restaurant_tables t  ON t.zone_id  = z.id AND t.is_active = true
        LEFT JOIN order_headers oh ON oh.table_id = t.id AND oh.status = 'OPEN'
        LEFT JOIN employees e      ON oh.waiter_id = e.id
        WHERE z.is_active = true
        ORDER BY z.name, t.code
    `);

export const getTableByCode = async (c, tableCode) =>
    await executeQuery(c, `
        SELECT id FROM restaurant_tables WHERE code = $1 AND is_active = true
    `, [tableCode]);

export const getEmployeeByNumber = async (c, employeeNumber) =>
    await executeQuery(c, `
        SELECT id FROM employees WHERE employee_number = $1 AND is_active = true
    `, [employeeNumber]);

export const getOpenOrder = async (c, tableId) =>
    await executeQuery(c, `
        SELECT code, total FROM order_headers WHERE table_id = $1 AND status = 'OPEN'
    `, [tableId]);

export const getOpenOrderByTableCode = async (c, tableCode) =>
    await executeQuery(c, `
        SELECT oh.code
        FROM order_headers oh
        JOIN restaurant_tables rt ON oh.table_id = rt.id
        WHERE rt.code = $1 AND oh.status = 'OPEN'
        ORDER BY oh.created_at DESC
        LIMIT 1
    `, [tableCode]);

export const insertOrder = async (c, orderCode, tableId, waiterId, diners) =>
    await executeQuery(c, `
        INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total)
        VALUES ($1, $2, $3, $4, 'OPEN', 0)
        RETURNING code
    `, [orderCode, tableId, waiterId, diners]);

export const submitOrderSP = async (c, payload) =>
    await executeQuery(c, `CALL public.sp_pos_submit_order($1::JSONB)`, [JSON.stringify(payload)]);

export const setOrderAwaitingPayment = async (c, orderCode) =>
    await executeQuery(c, `
        UPDATE order_headers
        SET status = 'AWAITING_PAYMENT', updated_at = CURRENT_TIMESTAMP
        WHERE code = $1
    `, [orderCode]);

export const collectItemSP = async (c, itemId, employeeNumber) =>
    await executeQuery(c, `CALL public.sp_pos_collect_item($1::UUID, $2::VARCHAR)`, [itemId, employeeNumber]);

export const deliverItem = async (c, itemId) =>
    await executeQuery(c, `
        UPDATE order_items
        SET status = 'DELIVERED'
        WHERE id = $1 AND status = 'COLLECTED'
        RETURNING id
    `, [itemId]);

export const getOrderItems = async (c, orderId) =>
    await executeQuery(c, `
        SELECT
            oi.id,
            md.code AS dish_code,
            md.name,
            oi.quantity,
            oi.unit_price,
            oi.subtotal,
            oi.status,
            md.has_recipe
        FROM order_items oi
        JOIN menu_dishes md ON oi.dish_id = md.id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC
    `, [orderId]);

export const getOpenOrderWithId = async (c, tableCode) =>
    await executeQuery(c, `
        SELECT id, code, status
        FROM order_headers
        WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = $1)
          AND status = 'OPEN'
    `, [tableCode]);