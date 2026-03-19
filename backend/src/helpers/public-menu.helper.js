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
        // En una BBDD real la Violación de Foreing Key arrojaría constraint nulo
        if (error.message.includes('Mesa no encontrada')) {
            const err = new Error(error.message);
            err.statusCode = 404;
            throw err;
        }
        console.error('[Helper] registerWaiterCall Error:', error);
        throw error;
    }
};
