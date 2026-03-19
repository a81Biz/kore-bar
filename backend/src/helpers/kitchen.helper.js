import { AppError } from '../utils/errors.util.js';
import * as kitchenModel from '../models/kitchen.model.js';

// ============================================================
// GET /dishes/pending
// Platillos sin receta asignada (bandeja de pendientes)
// ============================================================
export const getPendingDishes = async (state, c) => {
    try {
        const rows = await kitchenModel.getPendingDishes(c);
        state.dishes = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getPendingDishes:', error);
        throw new AppError('Error obteniendo platillos pendientes', 500);
    }
};

// ============================================================
// POST /ingredients
// Alta de insumo en inventory_items
// ============================================================
export const createIngredient = async (state, c) => {
    const { code, name, unit } = state.payload;

    try {
        await kitchenModel.createIngredient(c, code, name, unit);
        state.message = 'Insumo creado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in createIngredient:', error);
        throw new AppError('Error creando el insumo', 500);
    }
};

// ============================================================
// GET /ingredients
// Lista de insumos activos del catálogo de inventario
// ============================================================
export const getIngredients = async (state, c) => {
    try {
        const rows = await kitchenModel.getIngredients(c);
        state.ingredients = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getIngredients:', error);
        throw new AppError('Error obteniendo insumos', 500);
    }
};

// ============================================================
// POST /recipes/items
// Agrega o actualiza un ingrediente en la receta de un platillo
// ============================================================
export const addRecipeItem = async (state, c) => {
    const { dishCode, ingredientCode, quantity } = state.payload;

    try {
        await kitchenModel.addRecipeItem(c, dishCode, ingredientCode, quantity);
        state.message = 'Ingrediente agregado a la receta exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in addRecipeItem:', error);
        throw new AppError('Error agregando ingrediente a la receta', 500);
    }
};

// ============================================================
// GET /dishes/finished
// Catálogo de platillos con receta completa (recetario)
// ============================================================
export const getFinishedDishes = async (state, c) => {
    try {
        const rows = await kitchenModel.getFinishedDishes(c);
        state.dishes = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getFinishedDishes:', error);
        throw new AppError('Error obteniendo catálogo de recetario', 500);
    }
};

// ============================================================
// GET /recipes/:dishCode/bom
// BOM (Bill of Materials) — ingredientes y cantidades de un platillo
// ============================================================
export const getRecipeBOM = async (state, c) => {
    const { dishCode } = state.params;

    try {
        const rows = await kitchenModel.getRecipeBOM(c, dishCode);

        if (rows.length === 0) {
            throw new AppError(`No se encontró receta para el platillo '${dishCode}'`, 404);
        }

        state.bom = rows.map(r => ({
            code: r.code,
            name: r.name,
            quantity: parseFloat(r.qty),
            unit: r.unit
        }));
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getRecipeBOM:', error);
        throw new AppError('Error obteniendo ingredientes del platillo', 500);
    }
};

// ============================================================
// PUT /recipes/:dishCode/tech-sheet
// Actualiza ficha técnica: método de preparación e imagen
// ============================================================
export const updateTechSheet = async (state, c) => {
    const { dishCode } = state.params;
    const { preparationMethod, imageUrl } = state.payload;

    try {
        await kitchenModel.updateTechSheet(c, dishCode, preparationMethod, imageUrl || null);
        state.message = 'Ficha técnica actualizada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in updateTechSheet:', error);
        throw new AppError('Error actualizando la ficha técnica', 500);
    }
};

// ============================================================
// GET /kitchen/board
// Tablero KDS: platillos con receta agrupados por status
// ============================================================
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
        console.error('Raw DB Error in getKitchenBoard:', error);
        throw new AppError('Error obteniendo el tablero de cocina', 500);
    }
};

// ============================================================
// PUT /kitchen/items/:itemId/status
// Avanza el status: PENDING_KITCHEN → PREPARING → READY
// ============================================================
export const updateKitchenItemStatus = async (state, c) => {
    const { params = {}, payload } = state;
    const { itemId } = params;
    const { status } = payload;

    if (!['PREPARING', 'READY'].includes(status)) {
        throw new AppError('Status inválido para la cocina', 400);
    }

    try {
        const result = status === 'PREPARING'
            ? await kitchenModel.setItemPreparing(c, itemId)
            : await kitchenModel.setItemReady(c, itemId);

        if (result.length === 0) {
            throw new AppError('No se pudo actualizar el estado del platillo. Revisa el flujo operacional.', 404);
        }

        state.itemId = itemId;
        state.status = status;
        state.message = `Platillo actualizado a ${status}`;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in updateKitchenItemStatus:', error);
        throw new AppError('Error al actualizar el item de cocina', 500);
    }
};