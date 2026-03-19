import {
    getCashierBoard,
    getCashierCorte,
    getCashierEmployees,
    processPayment,
    markTicketInvoiced,
    getTicketByFolio as getTicketByFolioModel,
    getLastTicketByTableCode
} from '../models/cashier.model.js';
import { getUserForPin } from '../models/auth.model.js';
import { AppError } from '../utils/errors.util.js';

// ── TABLERO DE CAJA ───────────────────────────────────────────
export const getBoard = async (state, c) => {
    const rows = await getCashierBoard(c);
    state.tables = rows.map(r => ({
        tableCode: r.table_code,
        zoneName: r.zone_name,
        orderCode: r.order_code,
        total: r.total,
        waitingSince: r.waiting_since,
        waiterFirstName: r.waiter_first_name,
        waiterLastName: r.waiter_last_name
    }));
};

// ── CORTE Z ───────────────────────────────────────────────────
export const getCorte = async (state, c) => {
    const rows = await getCashierCorte(c);
    state.corte = {
        date: new Date().toISOString().split('T')[0],
        byMethod: rows
    };
};

// ── EMPLEADOS ELEGIBLES ───────────────────────────────────────
export const getEmployees = async (state, c) => {
    const employees = await getCashierEmployees(c);
    state.employees = employees;
};

// ── GET TICKET ────────────────────────────────────────────────
export const getTicketByFolio = async (state, c) => {
    const folio = state.params?.folio;
    if (!folio) throw new AppError('El folio es requerido como parámetro de ruta', 400);

    const ticket = await getTicketByFolioModel(c, folio);
    if (!ticket) throw new AppError(`Ticket no encontrado: ${folio}`, 404);

    state.ticket = ticket;
    state.message = 'Ticket encontrado';
};

// ── LOGIN CAJA ────────────────────────────────────────────────
export const validateCashierPin = async (state, c) => {
    const { employeeNumber, pin } = state.payload;
    const user = await getUserForPin(c, employeeNumber, String(pin));

    if (!user || !user.isPinValid) throw new AppError('Número de empleado o PIN incorrecto', 401);
    if (!user.canAccessCashier) throw new AppError('El empleado no tiene permisos de acceso a caja', 403);

    state.employeeNumber = user.employeeNumber;
    state.firstName = user.firstName;
    state.lastName = user.lastName;
    state.message = `Bienvenido, ${user.firstName}`;
};

// ── PROCESAR PAGO ─────────────────────────────────────────────
export const submitPayment = async (state, c) => {
    const tableCode = state.params?.tableCode;
    const { cashierCode, tip = 0, payments } = state.payload;

    if (!tableCode || !cashierCode) {
        throw new AppError('tableCode y cashierCode son requeridos', 400);
    }
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
        throw new AppError('Se requiere al menos una línea de pago en payments[]', 400);
    }

    try {
        await processPayment(c, { tableCode, cashierCode, tip, payments });

        const ticket = await getLastTicketByTableCode(c, tableCode);
        state.folio = ticket?.folio;
        state.total = ticket?.total;
        state.message = 'Pago procesado correctamente';

    } catch (error) {
        if (error.isOperational) throw error;
        if (
            error.message?.includes('AWAITING_PAYMENT') ||
            error.message?.includes('no encontrada') ||
            error.message?.includes('no encontrado') ||
            error.message?.includes('monto recibido') ||
            error.code === 'P0001'
        ) {
            throw new AppError(error.message, 400);
        }
        console.error('Raw DB Error in submitPayment:', error);
        throw new AppError('Error procesando el pago', 500);
    }
};

// ── FACTURA CFDI ──────────────────────────────────────────────
export const requestInvoice = async (state, c) => {
    const folio = state.params?.folio;
    if (!folio) throw new AppError('El folio es requerido como parámetro de ruta', 400);

    const ticket = await getTicketByFolioModel(c, folio);
    if (!ticket) throw new AppError(`Ticket no encontrado: ${folio}`, 404);
    if (ticket.isInvoiced) throw new AppError(`El ticket ${folio} ya fue facturado anteriormente`, 409);

    const { rfc, cp, razonSocial, regimenFiscal, usoCfdi, email } = state.payload;
    const invoiceData = { rfc, cp, razonSocial, regimenFiscal, usoCfdi };
    if (email) invoiceData.email = email;

    await markTicketInvoiced(c, folio, invoiceData);

    state.folio = folio;
    state.message = `Solicitud de factura registrada para el ticket ${folio}`;
};