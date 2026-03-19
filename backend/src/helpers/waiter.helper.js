import { AppError } from '../utils/errors.util.js';
import * as waiterModel from '../models/waiter.model.js';

// ============================================================
// POST /waiters/login
// Valida PIN del mesero y retorna sus datos de sesión
// ============================================================
export const validateWaiterPin = async (state, c) => {
    const { employeeNumber, pin } = state.payload;

    try {
        const result = await waiterModel.validatePin(c, employeeNumber, pin);

        if (result.length === 0) {
            throw new AppError('Número de empleado o PIN incorrecto', 401);
        }

        const employee = result[0];

        if (!employee.is_active) {
            throw new AppError('El empleado no está activo', 401);
        }

        state.employeeNumber = employeeNumber;
        state.employeeId = employee.id;
        state.firstName = employee.first_name;
        state.lastName = employee.last_name;
        state.message = 'Login exitoso';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in validateWaiterPin:', error);
        throw new AppError('Error interno validando PIN', 500);
    }
};

// ============================================================
// GET /waiters/layout
// Plano de zonas y mesas con su status actual
// ============================================================
export const getWaiterLayout = async (state, c) => {
    try {
        const rows = await waiterModel.getLayout(c);

        const layoutMap = {};
        for (const row of rows) {
            if (!layoutMap[row.zone_code]) {
                layoutMap[row.zone_code] = {
                    zoneCode: row.zone_code,
                    zoneName: row.zone_name,
                    tables: []
                };
            }
            layoutMap[row.zone_code].tables.push({
                tableCode: row.table_code,
                capacity: row.capacity,
                status: row.status,
                waiterName: row.waiter_name || null
            });
        }

        state.layout = Object.values(layoutMap);
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getWaiterLayout:', error);
        throw new AppError('Error obteniendo el plano de mesas', 500);
    }
};

// ============================================================
// POST /waiters/tables/:tableCode/open
// Abre una mesa creando una orden OPEN — idempotente si ya está abierta
// ============================================================
export const openTable = async (state, c) => {
    const { params = {}, payload } = state;
    const { tableCode } = params;
    const { employeeNumber, diners } = payload;

    try {
        const tables = await waiterModel.getTableByCode(c, tableCode);
        if (tables.length === 0) {
            throw new AppError('La mesa no existe o está inactiva', 404);
        }
        const tableId = tables[0].id;

        const employees = await waiterModel.getEmployeeByNumber(c, employeeNumber);
        if (employees.length === 0) {
            throw new AppError('El empleado no existe o está inactivo', 404);
        }
        const waiterId = employees[0].id;

        const existingOrder = await waiterModel.getOpenOrder(c, tableId);
        if (existingOrder.length > 0) {
            // Idempotente: devuelve la orden ya abierta sin error
            state.orderCode = existingOrder[0].code;
            return;
        }

        const orderCode = `ORD-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const result = await waiterModel.insertOrder(c, orderCode, tableId, waiterId, diners || 1);

        state.orderCode = result[0].code;
        state.message = 'Mesa abierta exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in openTable:', error);
        throw new AppError('Error al abrir la mesa', 500);
    }
};

// ============================================================
// POST /waiters/tables/:tableCode/orders
// Envía una comanda al SP atómico de cocina
// ============================================================
export const submitOrder = async (state, c) => {
    const { params = {}, payload } = state;
    const { tableCode } = params;
    const { employeeNumber, items } = payload;

    if (!Array.isArray(items) || items.length === 0) {
        throw new AppError('El pedido debe incluir al menos un artículo', 400);
    }

    try {
        await waiterModel.submitOrderSP(c, {
            waiterCode: employeeNumber,
            tableCode,
            diners: 1,
            items
        });

        const res = await waiterModel.getOpenOrderByTableCode(c, tableCode);
        state.orderCode = res.length > 0 ? res[0].code : 'UNKNOWN';
        state.message = 'Comanda enviada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in submitOrder:', error);
        throw new AppError('Error al enviar la comanda', 500);
    }
};

// ============================================================
// POST /waiters/tables/:tableCode/close
// Cierra la mesa pasando la orden a AWAITING_PAYMENT
// ============================================================
export const closeTable = async (state, c) => {
    const { params = {}, payload } = state;
    const { tableCode } = params;
    const { employeeNumber } = payload;

    try {
        const tables = await waiterModel.getTableByCode(c, tableCode);
        if (tables.length === 0) {
            throw new AppError('La mesa no existe o está inactiva', 404);
        }
        const tableId = tables[0].id;

        const employees = await waiterModel.getEmployeeByNumber(c, employeeNumber);
        if (employees.length === 0) {
            throw new AppError('El empleado no existe o está inactivo', 404);
        }

        const existingOrder = await waiterModel.getOpenOrder(c, tableId);
        if (existingOrder.length === 0) {
            throw new AppError('No hay ninguna orden abierta en esta mesa', 400);
        }

        const openOrderCode = existingOrder[0].code;

        await waiterModel.setOrderAwaitingPayment(c, openOrderCode);

        state.orderCode = openOrderCode;
        state.totalPaid = parseFloat(existingOrder[0].total);
        state.message = 'Mesa enviada a caja exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in closeTable:', error);
        throw new AppError('Error al cerrar la mesa', 500);
    }
};

// ============================================================
// PUT /waiters/tables/:tableCode/items/:itemId/collect
// El mesero recolecta el platillo de cocina — descuenta inventario
// ============================================================
export const waiterCollectItem = async (state, c) => {
    const { params = {}, payload } = state;
    const { itemId } = params;
    const { employeeNumber } = payload;

    try {
        await waiterModel.collectItemSP(c, itemId, employeeNumber);
        state.message = 'Artículo recolectado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in waiterCollectItem:', error);
        throw new AppError('Error al recolectar el artículo', 500);
    }
};

// ============================================================
// PUT /waiters/tables/:tableCode/items/:itemId/deliver
// El mesero entrega el platillo en la mesa
// ============================================================
export const waiterDeliverItem = async (state, c) => {
    const { params = {} } = state;
    const { itemId } = params;

    try {
        const res = await waiterModel.deliverItem(c, itemId);

        if (res.length === 0) {
            throw new AppError('El artículo no pudo ser entregado. Verifique que ya haya sido recolectado', 400);
        }

        state.message = 'Artículo entregado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in waiterDeliverItem:', error);
        throw new AppError('Error al marcar el artículo como entregado', 500);
    }
};

// ============================================================
// GET /waiters/tables/:tableCode/order
// Estado actual de la orden de una mesa con sus items
// ============================================================
export const getWaiterOrderStatus = async (state, c) => {
    const { params = {} } = state;
    const { tableCode } = params;

    try {
        const orderResult = await waiterModel.getOpenOrderWithId(c, tableCode);

        if (orderResult.length === 0) {
            state.orderCode = null;
            state.items = [];
            state.canClose = false;
            return;
        }

        const order = orderResult[0];
        state.orderCode = order.code;

        const items = await waiterModel.getOrderItems(c, order.id);
        state.items = items;

        const pendingItems = items.filter(i => i.status !== 'DELIVERED');
        state.canClose = items.length > 0 && pendingItems.length === 0;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getWaiterOrderStatus:', error);
        throw new AppError('Error al obtener el estado de la orden', 500);
    }
};