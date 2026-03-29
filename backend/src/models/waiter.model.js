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
        p_table_code: tableCode,
        p_employee_number: employeeNumber,
        p_diners: diners ?? 1
    });

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


// ── FUNCIONES REQUERIDAS POR waiter.helper.js ─────────────────
// El helper opera con consultas atómicas granulares (valida mesa,
// empleado y orden en pasos separados antes de mutar).

// Valida employee_number + pin_code → [{id, first_name, last_name, is_active}] o []
export const validatePin = async (c, employeeNumber, pin) =>
    await executeQuery(c, `
        SELECT id, first_name, last_name, is_active
        FROM employees
        WHERE employee_number = $1 AND pin_code = $2 AND is_active = true
        LIMIT 1
    `, [employeeNumber, pin]);

// Mesa por code → [{id, code}] o []
export const getTableByCode = async (c, tableCode) =>
    await executeQuery(c, `
        SELECT id, code FROM restaurant_tables
        WHERE code = $1 AND is_active = true
        LIMIT 1
    `, [tableCode]);

// Empleado activo por number → [{id, employee_number, is_active}] o []
export const getEmployeeByNumber = async (c, employeeNumber) =>
    await executeQuery(c, `
        SELECT id, employee_number, is_active FROM employees
        WHERE employee_number = $1 AND is_active = true
        LIMIT 1
    `, [employeeNumber]);

// Orden OPEN por table UUID → [{id, code, total}] o []
export const getOpenOrder = async (c, tableId) =>
    await executeQuery(c, `
        SELECT id, code, total FROM order_headers
        WHERE table_id = $1 AND status = 'OPEN'
        LIMIT 1
    `, [tableId]);

// INSERT directo de orden — el helper ya resolvió los UUIDs → [{code}]
export const insertOrder = async (c, orderCode, tableId, waiterId, diners) =>
    await executeQuery(c, `
        INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total)
        VALUES ($1, $2, $3, $4, 'OPEN', 0)
        RETURNING code
    `, [orderCode, tableId, waiterId, diners]);

// Alias nombrado que usa submitOrder del helper
export const submitOrderSP = async (c, payload) =>
    await executeStoredProcedure(c, 'sp_pos_submit_order', {
        p_payload: payload
    }, { p_payload: 'JSONB' });

// Orden OPEN por tableCode → [{code}] o []
export const getOpenOrderByTableCode = async (c, tableCode) =>
    await executeQuery(c, `
        SELECT oh.code FROM order_headers oh
        JOIN restaurant_tables rt ON rt.id = oh.table_id
        WHERE rt.code = $1 AND oh.status = 'OPEN'
        LIMIT 1
    `, [tableCode]);

// SP que descuenta inventario y pasa item a COLLECTED
export const collectItemSP = async (c, itemId, employeeNumber) =>
    await executeStoredProcedure(c, 'sp_pos_collect_item', {
        p_item_id: itemId,
        p_waiter_code: employeeNumber
    }, { p_item_id: 'UUID' });

// Orden OPEN con UUID incluido (para getOrderItems) → [{id, code}] o []
export const getOpenOrderWithId = async (c, tableCode) =>
    await executeQuery(c, `
        SELECT oh.id, oh.code FROM order_headers oh
        JOIN restaurant_tables rt ON rt.id = oh.table_id
        WHERE rt.code = $1 AND oh.status = 'OPEN'
        LIMIT 1
    `, [tableCode]);

// Avanza orden a AWAITING_PAYMENT por code (el helper ya validó estado previo)
export const setOrderAwaitingPayment = async (c, orderCode) =>
    await executeQuery(c, `
        UPDATE order_headers
        SET status = 'AWAITING_PAYMENT', updated_at = CURRENT_TIMESTAMP
        WHERE code = $1 AND status = 'OPEN'
    `, [orderCode]);

// ── STOCK DE PISO ─────────────────────────────────────────────
// Devuelve el stock disponible en LOC-PISO para que el frontend
// de meseros cruce disponibilidad de platillos en tiempo real.
// Reutiliza las mismas tablas que admin-inventory pero filtra por
// la locación de piso — sin exponer el dominio de inventario admin.
export const getFloorStock = async (c) =>
    await executeQuery(c, `
        SELECT 
            mc.name AS "categoryName",
            mc.code AS "categoryCode",
            mc.route_to_kds AS "routeToKds",
            md.code AS "dishCode",
            md.name AS "name",
            md.price,
            md.image_url AS "imageUrl",
            md.has_recipe AS "hasRecipe",
            md.is_active AS "isActive",
            COALESCE(SUM(isl.stock), 99)::numeric AS "stock_available"
        FROM menu_dishes md
        JOIN menu_categories mc ON md.category_id = mc.id
        LEFT JOIN inventory_items ii ON ii.code = md.code
        LEFT JOIN inventory_stock_locations isl ON isl.item_id = ii.id
        LEFT JOIN inventory_locations il ON il.id = isl.location_id AND il.code = 'LOC-PISO'
        WHERE md.is_active = true AND mc.is_active = true
        GROUP BY mc.id, md.id
        ORDER BY mc.name ASC, md.name ASC;
    `);

// consulta quiénes tienen zonas y mesas asignadas
export const getWaiters = async (c) =>
    await executeQuery(c, `
        SELECT DISTINCT
            e.employee_number
            , e.first_name || ' ' || e.last_name AS nombre
            , ra.shift
            , rz.name AS zona 
        FROM restaurant_assignments ra 
        JOIN employees e 
            ON e.employee_number = ra.employee_number 
        JOIN restaurant_zones rz 
            ON rz.id = ra.zone_id 
        ORDER BY e.employee_number DESC`);
