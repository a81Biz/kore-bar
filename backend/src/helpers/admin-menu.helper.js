import * as MenuModel from '../models/admin-menu.model.js';
import { AppError } from '../utils/errors.util.js';

// ============================================================
// CATEGORÍAS
// ============================================================
export const createCategoryHandler = async (state, c) => {
    const { categoryCode, name, description } = state.payload;
    try {
        await MenuModel.createCategory(c, categoryCode, name, description);
        state.message = 'Categoría creada exitosamente';
    } catch (error) {
        if (error.code === '23505') throw new AppError('El código de categoría ya existe', 400);
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveCategory:', error);
        throw new AppError(`Error creando categoría: ${error.message}`, 500);
    }
};

export const updateCategory = async (state, c) => {
    const { code } = state.params; // ← antes: state.params (objeto completo)
    const { name, description, isActive } = state.payload;
    try {
        await MenuModel.updateCategory(c, code, name, description, isActive);
        state.message = 'Categoría actualizada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in updateCategory:', error);
        throw new AppError(`Error actualizando categoría: ${error.message}`, 500);
    }
};

export const getCategories = async (state, c) => {
    try {
        state.categories = await MenuModel.getCategories(c);
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getCategories:', error);
        throw new AppError('Error obteniendo categorías', 500);
    }
};

export const deleteCategory = async (state, c) => {
    const { code } = state.params; // ← antes: state.params (objeto completo)
    try {
        await MenuModel.deleteCategorySmart(c, code);
        state.message = 'Categoría eliminada exitosamente';
    } catch (error) {
        if (error.code === 'P0001') throw new AppError(error.message, 409);
        if (error.isOperational) throw error;
        console.error('Raw DB Error in deleteCategory:', error);
        throw new AppError(`Error eliminando categoría: ${error.message}`, 500);
    }
};

// ============================================================
// PLATILLOS
// ============================================================
export const createDishHandler = async (state, c) => {
    const { dishCode, categoryCode, name, description, price, imageUrl } = state.payload;
    try {
        await MenuModel.createDish(c, dishCode, categoryCode, name, description, price, imageUrl);
        state.message = 'Platillo creado exitosamente';
    } catch (error) {
        if (error.code === '23505') throw new AppError('El código del platillo ya existe', 400);
        if (error.code === 'P0002') throw new AppError('La categoría asignada no existe', 400);
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveDish:', error);
        throw new AppError(`Error creando platillo: ${error.message}`, 500);
    }
};

export const updateDishHandler = async (state, c) => {
    const { code } = state.params; // ← antes: state.params (objeto completo)
    const { categoryCode, name, description, price, imageUrl, isActive, canPickup } = state.payload;
    try {
        await MenuModel.updateDish(c, code, categoryCode, name, description, price, imageUrl, isActive, canPickup);
        state.message = 'Platillo actualizado exitosamente';
    } catch (error) {
        if (error.code === 'P0002') throw new AppError('La categoría asignada no existe', 400);
        if (error.isOperational) throw error;
        console.error('Raw DB Error in updateDish:', error);
        throw new AppError(`Error actualizando platillo: ${error.message}`, 500);
    }
};

export const getDishes = async (state, c) => {
    try {
        state.dishes = await MenuModel.getDishes(c);
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getDishes:', error);
        throw new AppError('Error obteniendo platillos', 500);
    }
};

export const deleteDishHandler = async (state, c) => {
    const { code } = state.params; // ← antes: state.params (objeto completo)
    try {
        await MenuModel.deleteDishSmart(c, code);
        state.message = 'Platillo eliminado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in deleteDish:', error);
        throw new AppError(`Error eliminando platillo: ${error.message}`, 500);
    }
};