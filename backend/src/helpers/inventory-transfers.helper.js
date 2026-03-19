import { AppError } from '../utils/errors.util.js';
import * as transfersModel from '../models/inventory-transfers.model.js';

// ============================================================
// POST /transfers
// Traspaso de insumos entre ubicaciones (Bodega → Cocina, etc.)
// ============================================================
export const saveKardexTransfer = async (state, c) => {
    const { sourceLocation, targetLocation, items } = state.payload;

    if (!items || items.length === 0) {
        throw new AppError('El traspaso no contiene insumos', 400);
    }

    for (const item of items) {
        if (!item.itemCode || item.qty === undefined || item.qty === null) {
            throw new AppError('Faltan campos requeridos en los insumos (itemCode, qty)', 400);
        }
    }

    try {
        for (const item of items) {
            await transfersModel.kardexTransfer(
                c,
                item.itemCode,
                sourceLocation,
                targetLocation,
                item.qty,
                `TRF-${Date.now()}`
            );
        }
        state.message = 'Traspaso registrado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveKardexTransfer:', error);
        throw new AppError(`Error en transacción de Kardex: ${error.message}`, 500);
    }
};

// ============================================================
// POST /sync  (PULL)
// POST /webhook  (PUSH)
// Ingesta masiva y sincronización de compras
// ============================================================
export const syncPurchasesToKardex = async (state, c) => {
    const payload = state.payload;

    if (!payload.supplier || !payload.items || payload.items.length === 0) {
        throw new AppError('El payload no contiene información válida de compras', 400);
    }

    try {
        await transfersModel.syncPurchases(c, payload);
        state.message = 'Ingesta y sincronización masiva procesada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in syncPurchasesToKardex:', error);
        throw new AppError(`Error en ingesta de datos: ${error.message}`, 500);
    }
};

// ============================================================
// POST /adjustments
// Ajuste físico / cierre de turno (merma o sobrante)
// ============================================================
export const saveKardexAdjustment = async (state, c) => {
    const { locationCode, items } = state.payload;

    if (!items || items.length === 0) {
        throw new AppError('El ajuste no contiene insumos', 400);
    }

    try {
        for (const item of items) {
            await transfersModel.kardexAdjustment(
                c,
                locationCode,
                item.itemCode,
                item.realStock,
                item.note || null
            );
        }
        state.message = 'Ajuste físico procesado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveKardexAdjustment:', error);
        throw new AppError(`Error procesando ajuste físico: ${error.message}`, 500);
    }
};