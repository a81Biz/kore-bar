import { AppError } from '../utils/errors.util.js';
import * as cashierModel from '../models/cashier.model.js';

// ============================================================
// GET /cashier/employees
// Lista empleados de áreas con can_access_cashier = true
// ============================================================
export const getCashierEmployees = async (state, c) => {
    try {
        const result = await cashierModel.getCashierEmployees(c);
        state.employees = result;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getCashierEmployees:', error);
        throw new AppError('Error obteniendo empleados de caja', 500);
    }
};

// ============================================================
// POST /cashier/login
// Valida PIN y verifica permiso can_access_cashier en el área
// ============================================================
export const validateCashierPin = async (state, c) => {
    const { employeeNumber, pin } = state.payload;

    try {
        const pinResult = await cashierModel.validateCashierPin(c, employeeNumber, pin);

        if (pinResult.length === 0) {
            throw new AppError('Número de empleado o PIN incorrecto', 401);
        }

        const employee = pinResult[0];

        if (!employee.is_active) {
            throw new AppError('El empleado no está activo', 401);
        }

        // Verificar que el empleado pertenezca a un área con permiso de caja
        // Buscamos si el empleado tiene alguna posición en un área con can_access_cashier = true
        // Si no hay posiciones configuradas, aceptamos a todos los empleados activos (configuración inicial)
        const permCount = await cashierModel.permissionQuery(c);
        const hasAnyPermArea = parseInt(permCount[0]?.total_areas_with_permission || 0) > 0;

        if (hasAnyPermArea) {
            // Hay áreas con permiso configuradas — verificar que el empleado esté en una de ellas
            const empPerm = await cashierModel.empPermQuery(c, employee.id);
            if (empPerm.length === 0) {
                throw new AppError('Este empleado no tiene permiso de acceso a caja', 403);
            }
        }
        // Si no hay ningún área con permiso configurada, se permite el acceso (setup inicial)

        state.employeeNumber = employeeNumber;
        state.employeeId = employee.id;
        state.firstName = employee.first_name;
        state.lastName = employee.last_name;
        state.message = 'Login successful';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in validateCashierPin:', error);
        throw new AppError('Error interno validando PIN de cajero', 500);
    }
};

// ============================================================
// GET /cashier/board
// Mesas en estado AWAITING_PAYMENT con detalle de consumo
// ============================================================
export const getCashierBoard = async (state, c) => {
    try {
        const rows = await cashierModel.getCashierBoard(c);

        state.tables = rows.map(r => ({
            tableCode: r.table_code,
            zoneName: r.zone_name,
            orderCode: r.order_code,
            total: parseFloat(r.total),
            waitingSince: r.waiting_since,
            waiterName: `${r.waiter_first_name} ${r.waiter_last_name}`
        }));
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getCashierBoard:', error);
        throw new AppError('Error obteniendo el tablero de caja', 500);
    }
};

// ============================================================
// POST /cashier/tables/:tableCode/pay
// Llama al SP atómico que cierra la mesa y emite el ticket
// ============================================================
export const processPayment = async (state, c) => {
    const { params = {}, payload } = state;
    const { tableCode } = params;
    const { cashierCode, payments, tip = 0 } = payload;

    try {
        if (!Array.isArray(payments) || payments.length === 0) {
            throw new AppError('Se requiere al menos una línea de pago', 400);
        }

        const spPayload = {
            tableCode,
            cashierCode,
            payments,
            tip
        };

        await cashierModel.cashierProcessPayment(c, JSON.stringify(spPayload));

        const ticketResult = await cashierModel.ticketQuery(c, tableCode);

        if (ticketResult.length === 0) {
            throw new AppError('No se pudo recuperar el folio del ticket', 500);
        }

        state.folio = ticketResult[0].folio;
        state.total = parseFloat(ticketResult[0].total);
        state.message = 'Pago procesado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in processPayment:', error);
        throw new AppError(`Error al procesar el pago: ${error.message}`, 400);
    }
};

// ============================================================
// GET /cashier/tickets/:folio
// Consulta pública de ticket por folio (para invoice.localhost)
// ============================================================
export const getTicketByFolio = async (state, c) => {
    const { params = {} } = state;
    const { folio } = params;

    try {
        // Datos del ticket
        const ticketRows = await cashierModel.getTicketByFolio(c, folio);

        if (ticketRows.length === 0) {
            throw new AppError(`Ticket con folio '${folio}' no encontrado`, 404);
        }

        const ticket = ticketRows[0];

        // Items del ticket
        const items = await cashierModel.itemsQuery(c, folio);

        state.ticket = {
            folio: ticket.folio,
            tableCode: ticket.table_code,
            zoneName: ticket.zone_name,
            subtotal: parseFloat(ticket.subtotal),
            tax: parseFloat(ticket.tax),
            tipTotal: parseFloat(ticket.tip_total),
            total: parseFloat(ticket.total),
            isInvoiced: ticket.is_invoiced,
            createdAt: ticket.created_at,
            items: items.map(i => ({
                name: i.name,
                quantity: i.quantity,
                unitPrice: parseFloat(i.unit_price),
                subtotal: parseFloat(i.subtotal)
            }))
        };
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getTicketByFolio:', error);
        throw new AppError('Error consultando el ticket', 500);
    }
};

// ============================================================
// GET /cashier/corte
// Corte Z: resumen de ventas del día por método de pago
// ============================================================
export const getCashierCorte = async (state, c) => {
    try {
        // Resumen por método de pago (del día actual)
        const corteRows = await cashierModel.getCashierCorte(c);

        // Total global de tickets del día
        const totalsRows = await cashierModel.totalsQuery(c);
        const totals = totalsRows[0] || {};

        state.corte = {
            date: new Date().toISOString().split('T')[0],
            totalTickets: parseInt(totals.total_tickets) || 0,
            grandTotal: parseFloat(totals.grand_total) || 0,
            grandTips: parseFloat(totals.grand_tips) || 0,
            byMethod: corteRows.map(r => ({
                method: r.method,
                transactions: parseInt(r.transactions),
                totalCollected: parseFloat(r.total_collected),
                totalTips: parseFloat(r.total_tips)
            }))
        };
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getCashierCorte:', error);
        throw new AppError('Error generando el corte de caja', 500);
    }
};
