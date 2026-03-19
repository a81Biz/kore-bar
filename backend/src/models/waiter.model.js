import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── LAYOUT ────────────────────────────────────────────────────
// Antes: JOIN manual de 4 tablas en el modelo
// Ahora: consulta a vw_waiter_floor_layout (crítico #6)

export const getLayout = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_waiter_floor_layout`);


// ── ORDEN ─────────────────────────────────────────────────────
// Antes: INSERT raw + consulta getOpenOrder separada
// Ahora: sp_pos_open_table (idempotente — si ya existe orden OPEN no falla)

export const openTable = async (c, tableCode, employeeNumber, diners) =>
    await executeStoredProcedure(c, 'sp_pos_open_table', {
        p_table_code:      tableCode,
        p_employee_number: employeeNumber,
        p_diners:          diners ?? 1
    });

// Alias para compatibilidad con helpers que llaman insertOrder
export const insertOrder = openTable;

export const getOpenOrderByTable = async (c, tableCode) => {
    const res = await executeQuery(c, `
        SELECT oh.id       AS "orderId",
               oh.code     AS "orderCode",
               oh.total,
               oh.status,
               oh.diners
        FROM order_headers oh
        JOIN restaurant_tables rt ON rt.id = oh.table_id
        WHERE rt.code = $1 AND oh.status = 'OPEN'
        LIMIT 1
    `, [tableCode]);
    return res[0] ?? null;
};

// Antes: UPDATE raw de status en el modelo
// Ahora: sp_pos_close_table con validación de máquina de estados en BD

export const setOrderAwaitingPayment = async (c, tableCode, employeeNumber) =>
    await executeStoredProcedure(c, 'sp_pos_close_table', {
        p_table_code:      tableCode,
        p_employee_number: employeeNumber
    });


// ── ITEMS ─────────────────────────────────────────────────────
// Antes: JOIN manual en el modelo
// Ahora: consulta a vw_order_items_detail (crítico #6)

export const getOrderItems = async (c, orderId) =>
    await executeQuery(c, `
        SELECT id, dish_code AS "dishCode", name, quantity,
               unit_price AS "unitPrice", subtotal, status,
               has_recipe AS "hasRecipe", created_at AS "createdAt"
        FROM vw_order_items_detail
        WHERE order_id = $1
        ORDER BY created_at ASC
    `, [orderId]);

// Antes: UPDATE raw sin validar estado previo
// Ahora: sp_pos_deliver_item con guard en BD (estado debe ser COLLECTED)

export const deliverItem = async (c, itemId) =>
    await executeStoredProcedure(c, 'sp_pos_deliver_item', {
        p_item_id: itemId
    }, { p_item_id: 'UUID' });

// ── ENVÍO DE COMANDA ──────────────────────────────────────────

export const submitOrder = async (c, payload) =>
    await executeStoredProcedure(c, 'sp_pos_submit_order', {
        p_payload: payload
    }, { p_payload: 'JSONB' });
