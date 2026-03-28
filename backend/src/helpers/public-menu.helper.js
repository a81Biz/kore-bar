import { PublicMenuModel } from '../models/public-menu.model.js';

export const getPublicMenu = async (state, c) => {
    try {
        state.data = await PublicMenuModel.getMenu();
    } catch (error) {
        console.error('[Helper] getPublicMenu Error:', error);
        throw error;
    }
};

export const registerWaiterCall = async (state, c) => {
    try {
        const tableCode = c.req.param('tableCode');
        const reason = state.payload.reason || 'ASSISTANCE';

        await PublicMenuModel.registerCall(tableCode, reason);

        state.data = { message: `Alerta registrada en mesa ${tableCode}`, reason };
    } catch (error) {
        if (error.message.includes('Mesa no encontrada')) {
            const err = new Error(error.message);
            err.statusCode = 404;
            throw err;
        }
        console.error('[Helper] registerWaiterCall Error:', error);
        throw error;
    }
};

// ── GET /waiters/calls ────────────────────────────────────────
// Devuelve llamadas PENDING de las últimas 2 horas.
export const getPendingCalls = async (state, c) => {
    try {
        const calls = await PublicMenuModel.getPendingCalls();
        state.calls = calls;
    } catch (error) {
        console.error('[Helper] getPendingCalls Error:', error);
        throw error;
    }
};

// ── PUT /waiters/calls/:callId/attend ─────────────────────────
// Marca una llamada como atendida.
export const attendWaiterCall = async (state, c) => {
    try {
        const { callId } = state.params;
        await PublicMenuModel.attendCall(callId);
        state.message = 'Llamada atendida exitosamente';
    } catch (error) {
        if (error.message.includes('no encontrada')) {
            const err = new Error(error.message);
            err.statusCode = 404;
            throw err;
        }
        console.error('[Helper] attendWaiterCall Error:', error);
        throw error;
    }
};
