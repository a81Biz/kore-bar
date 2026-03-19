import {
    getCashierBoard,
    getCashierCorte,
    getCashierEmployees,
    processPayment,
    markTicketInvoiced,
    getTicketByFolio
} from '../models/cashier.model.js';

// ── LECTURA ───────────────────────────────────────────────────

export const getBoard = async (state, c) => {
    const tables = await getCashierBoard(c);
    return { ...state, data: { tables } };
};

export const getCorte = async (state, c) => {
    const corte = await getCashierCorte(c);
    return { ...state, data: { corte } };
};

export const getEmployees = async (state, c) => {
    const employees = await getCashierEmployees(c);
    return { ...state, data: { employees } };
};

// ── PAGO ─────────────────────────────────────────────────────

export const submitPayment = async (state, c) => {
    const { tableCode, cashierCode, tip, payments } = state.payload;

    if (!tableCode || !cashierCode) {
        const err = new Error('tableCode y cashierCode son requeridos');
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
        const err = new Error('Se requiere al menos una línea de pago en payments[]');
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
    }

    await processPayment(c, { tableCode, cashierCode, tip, payments });
    return { ...state, message: 'Pago procesado correctamente' };
};

// ── FACTURA CFDI ──────────────────────────────────────────────
// Handler: requestInvoice
// Endpoint: POST /cashier/tickets/:folio/invoice
// Schema:   cashier-invoice-request.schema.json
//
// Flujo:
//   1. Extrae el folio del param (inyectado por SchemaRouter en state.params)
//   2. Verifica que el ticket exista y no haya sido facturado ya
//   3. Llama a markTicketInvoiced para guardar los datos y marcar is_invoiced = TRUE
//   4. Devuelve el folio y el mensaje de confirmación

export const requestInvoice = async (state, c) => {
    const folio = state.params?.folio;

    if (!folio) {
        const err = new Error('El folio es requerido como parámetro de ruta');
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
    }

    const ticket = await getTicketByFolio(c, folio);

    if (!ticket) {
        const err = new Error(`Ticket no encontrado: ${folio}`);
        err.statusCode = 404;
        err.isOperational = true;
        throw err;
    }

    if (ticket.isInvoiced) {
        const err = new Error(`El ticket ${folio} ya fue facturado anteriormente`);
        err.statusCode = 409;
        err.isOperational = true;
        throw err;
    }

    const { rfc, cp, razonSocial, regimenFiscal, usoCfdi, email } = state.payload;

    const invoiceData = { rfc, cp, razonSocial, regimenFiscal, usoCfdi };
    if (email) invoiceData.email = email;

    await markTicketInvoiced(c, folio, invoiceData);

    return {
        ...state,
        folio,
        message: `Solicitud de factura registrada para el ticket ${folio}`
    };
};
