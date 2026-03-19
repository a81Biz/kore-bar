import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── EMPLEADOS ELEGIBLES PARA CAJA ─────────────────────────────
// Antes: JOIN manual de 4 tablas en el modelo
// Ahora: consulta a vw_cashier_eligible_employees (crítico #6)

export const getCashierEmployees = async (c) =>
    await executeQuery(c, `
        SELECT employee_number AS "employeeNumber",
               first_name      AS "firstName",
               last_name       AS "lastName"
        FROM vw_cashier_eligible_employees
    `);

// ── TABLERO DE CAJA ───────────────────────────────────────────

export const getCashierBoard = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_cashier_board`);

// ── CORTE DE CAJA ─────────────────────────────────────────────

export const getCashierCorte = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_cashier_corte`);

// ── PAGO ─────────────────────────────────────────────────────

export const processPayment = async (c, payload) =>
    await executeStoredProcedure(c, 'sp_cashier_process_payment', {
        p_payload: payload
    }, { p_payload: 'JSONB' });

// ── FACTURA CFDI ──────────────────────────────────────────────
// Guarda los datos fiscales y marca el ticket como facturado.
// Llama a sp_mark_ticket_invoiced(p_folio, p_invoice_data JSONB).

export const markTicketInvoiced = async (c, folio, invoiceData) =>
    await executeStoredProcedure(c, 'sp_mark_ticket_invoiced', {
        p_folio: folio,
        p_invoice_data: invoiceData
    }, { p_invoice_data: 'JSONB' });

// ── TICKET POR FOLIO ──────────────────────────────────────────
// Incluye todos los campos que el helper y los tests necesitan.

export const getTicketByFolio = async (c, folio) => {
    const res = await executeQuery(c, `
        SELECT folio,
               is_invoiced  AS "isInvoiced",
               invoice_data AS "invoiceData",
               subtotal,
               tax,
               tip_total    AS "tipTotal",
               total
        FROM tickets
        WHERE folio = $1
        LIMIT 1
    `, [folio]);
    return res[0] ?? null;
};

// ── ÚLTIMO TICKET GENERADO PARA UNA MESA ─────────────────────
// Usado después de sp_cashier_process_payment para obtener el folio,
// ya que el SP no lo devuelve como valor de retorno.

export const getLastTicketByTableCode = async (c, tableCode) => {
    const res = await executeQuery(c, `
        SELECT t.folio, oh.total
        FROM tickets t
        JOIN order_headers oh      ON oh.id  = t.order_id
        JOIN restaurant_tables rt  ON rt.id  = oh.table_id
        WHERE rt.code = $1
        ORDER BY t.created_at DESC
        LIMIT 1
    `, [tableCode]);
    return res[0] ?? null;
};