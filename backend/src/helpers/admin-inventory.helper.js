import { AppError } from '../utils/errors.util.js';
import * as inventoryModel from '../models/admin-inventory.model.js';

// ============================================================
// GET /suppliers
// Lista de proveedores con sus precios por insumo
// ============================================================
export const getSuppliers = async (state, c) => {
    try {
        const rows = await inventoryModel.getSuppliers(c);
        state.suppliers = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getSuppliers:', error);
        throw new AppError('Error obteniendo proveedores', 500);
    }
};

// ============================================================
// POST /suppliers
// Alta de proveedor
// ============================================================
export const createSupplier = async (state, c) => {
    try {
        await inventoryModel.createSupplier(c, state.payload);
        state.message = 'Proveedor creado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in createSupplier:', error);
        throw new AppError('Error creando el proveedor', 500);
    }
};

// ============================================================
// GET /stock
// Stock actual por insumo, filtrable por ubicación
// locationCode viene como query param: /stock?location=LOC-COCINA
// ============================================================
export const getInventoryStock = async (state, c) => {
    const locationCode = state.payload?.location || null;

    try {
        const rows = await inventoryModel.getInventoryStock(c, locationCode);
        state.stock = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getInventoryStock:', error);
        throw new AppError('Error obteniendo el inventario', 500);
    }
};

// ============================================================
// GET /kardex
// Libro mayor de movimientos, filtrable por ubicación e insumo
// Params: /kardex?location=LOC-COCINA&item=INS-TOMATE
// ============================================================
export const getKardex = async (state, c) => {
    const locationCode = state.payload?.location || null;
    const itemCode = state.payload?.item || null;

    try {
        const rows = await inventoryModel.getKardex(c, locationCode, itemCode);
        state.kardex = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getKardex:', error);
        throw new AppError('Error obteniendo el kardex', 500);
    }
};

// ============================================================
// POST /suppliers/prices
// Upsert de precio de insumo por proveedor
// ============================================================
export const saveSupplierPrice = async (state, c) => {
    try {
        await inventoryModel.upsertSupplierPrice(c, state.payload);
        state.message = 'Precio de proveedor actualizado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveSupplierPrice:', error);
        throw new AppError('Error actualizando precio de proveedor', 500);
    }
};