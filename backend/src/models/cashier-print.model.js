// ============================================================
// cashier-print.model.js
// Modelo: Impresión de tickets térmicos
// Convención: Solo invocación a función de BD
// ============================================================
import { executeQuery } from '../db/connection.js';

export const getTicketPrintData = async (c, folio) => {
    const rows = await executeQuery(c,
        `SELECT fn_get_ticket_print_data($1) AS print_data`,
        [folio]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0].print_data;
};
