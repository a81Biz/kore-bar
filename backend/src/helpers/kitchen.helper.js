import { AppError } from '../utils/errors.util.js';
import * as kitchenModel from '../models/kitchen.model.js';

export const getPendingDishes = async (state, c) => {
    try {
        const rows = await kitchenModel.getPendingDishes(c);
        state.dishes = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo platillos pendientes', 500);
    }
};

export const createIngredient = async (state, c) => {
    const { code, name, unit } = state.payload;
    try {
        await kitchenModel.createIngredient(c, code, name, unit);
        state.message = 'Insumo creado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error creando el insumo', 500);
    }
};

export const getIngredientsHandler = async (state, c) => {
    try {
        const rows = await kitchenModel.getIngredients(c);
        state.ingredients = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo insumos', 500);
    }
};

// Alias usado en registry
export const getIngredients = getIngredientsHandler;

export const addRecipeItemHandler = async (state, c) => {
    const { dishCode, ingredientCode, quantity } = state.payload;
    try {
        await kitchenModel.addRecipeItem(c, dishCode, ingredientCode, quantity);
        state.message = 'Ingrediente agregado a la receta exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error agregando ingrediente a la receta', 500);
    }
};

export const getFinishedDishes = async (state, c) => {
    try {
        const rows = await kitchenModel.getFinishedDishes(c);
        state.dishes = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo catálogo de recetario', 500);
    }
};

export const getRecipeBOM = async (state, c) => {
    const { dishCode } = state.params;
    try {
        const rows = await kitchenModel.getRecipeBOM(c, dishCode);
        if (rows.length === 0) throw new AppError(`No se encontró receta para el platillo '${dishCode}'`, 404);
        state.bom = rows.map(r => ({
            code: r.code,
            name: r.name,
            quantity: parseFloat(r.qty),
            unit: r.unit
        }));
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo ingredientes del platillo', 500);
    }
};

export const getRecipesHandler = async (state, c) => {
    try {
        const rows = await kitchenModel.getRecipes(c);
        state.recipes = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo recetas', 500);
    }
};

export const updateTechSheetHandler = async (state, c) => {
    const { dishCode } = state.params;
    const { preparationMethod, imageUrl } = state.payload;
    try {
        await kitchenModel.updateTechSheet(c, dishCode, preparationMethod, imageUrl || null);
        state.message = 'Ficha técnica actualizada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error actualizando la ficha técnica', 500);
    }
};

// Alias legacy
export const updateTechSheet = updateTechSheetHandler;

export const getKitchenBoard = async (state, c) => {
    try {
        const rows = await kitchenModel.getKitchenBoard(c);
        const board = { pending: [], preparing: [], ready: [] };
        for (const row of rows) {
            const card = {
                itemId: row.item_id,
                dishName: row.dish_name,
                quantity: row.quantity,
                notes: row.notes,
                startedAt: row.started_at,
                createdAt: row.created_at,
                orderCode: row.order_code,
                tableCode: row.table_code,
                waiterName: row.waiter_name
            };
            if (row.status === 'PENDING_KITCHEN') board.pending.push(card);
            else if (row.status === 'PREPARING') board.preparing.push(card);
            else if (row.status === 'READY') board.ready.push(card);
        }
        state.board = board;
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo el tablero de cocina', 500);
    }
};

// Alias legacy
export const getKdsItems = getKitchenBoard;

// ── KDS: AVANCE DE ESTADO ─────────────────────────────────────
// El SP lanza RAISE EXCEPTION P0001 cuando la transición es inválida.
// Si no lanza, la operación fue exitosa — NO verificar result.length.

export const setPreparingHandler = async (state, c) => {
    const { itemId } = state.params;
    if (!['PREPARING', 'READY'].includes(state.payload?.status)) {
        throw new AppError('Status inválido para la cocina', 400);
    }
    try {
        await kitchenModel.setItemPreparing(c, itemId);
        state.itemId = itemId;
        state.status = 'PREPARING';
        state.message = 'Platillo actualizado a PREPARING';
    } catch (error) {
        if (error.isOperational) throw error;
        if (error.code === 'P0001' || error.message?.includes('no puede avanzar')) {
            throw new AppError(error.message, 404);
        }
        throw new AppError('Error al actualizar el item de cocina', 500);
    }
};

export const setReadyHandler = async (state, c) => {
    const { itemId } = state.params;
    try {
        await kitchenModel.setItemReady(c, itemId);
        state.itemId = itemId;
        state.status = 'READY';
        state.message = 'Platillo actualizado a READY';
    } catch (error) {
        if (error.isOperational) throw error;
        if (error.code === 'P0001' || error.message?.includes('no puede avanzar')) {
            throw new AppError(error.message, 404);
        }
        throw new AppError('Error al actualizar el item de cocina', 500);
    }
};

// Handler unificado que el schema usa (handler: "updateKitchenItemStatus")
export const updateKitchenItemStatus = async (state, c) => {
    const { params = {}, payload } = state;
    const { itemId } = params;
    const { status } = payload;

    if (!['PREPARING', 'READY'].includes(status)) {
        throw new AppError('Status inválido para la cocina', 400);
    }

    try {
        // El SP lanza P0001 si la transición es inválida.
        // Si no lanza, fue exitoso — NO hay rows que verificar.
        if (status === 'PREPARING') {
            await kitchenModel.setItemPreparing(c, itemId);
        } else {
            await kitchenModel.setItemReady(c, itemId);
        }
        state.itemId = itemId;
        state.status = status;
        state.message = `Platillo actualizado a ${status}`;
    } catch (error) {
        if (error.isOperational) throw error;
        if (error.code === 'P0001' || error.message?.includes('no puede avanzar')) {
            throw new AppError(error.message, 404);
        }
        console.error('Raw DB Error in updateKitchenItemStatus:', error);
        throw new AppError('Error al actualizar el item de cocina', 500);
    }
};