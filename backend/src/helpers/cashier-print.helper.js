// ============================================================
// cashier-print.helper.js
// Helper: Impresión de tickets térmicos
// Convención: Recibe state con params de ruta, delega al modelo.
// ============================================================
import * as model from '../models/cashier-print.model.js';
import { AppError } from '../utils/errors.util.js';

export const fetchTicketPrintData = async (c, state) => {
    const folio = state.params?.folio || state.payload?.folio;

    if (!folio) {
        throw new AppError('El folio del ticket es requerido.', 400);
    }

    // Validar formato del folio
    if (!/^TKT-/.test(folio)) {
        throw new AppError('Formato de folio inválido. Debe iniciar con TKT-.', 400);
    }

    const data = await model.getTicketPrintData(c, folio);

    if (!data) {
        throw new AppError(`Ticket con folio ${folio} no encontrado.`, 404);
    }

    state.result = { success: true, data };
};
