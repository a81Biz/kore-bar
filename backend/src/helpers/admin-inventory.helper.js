import { AppError } from '../utils/errors.util.js';
import * as inventoryModel from '../models/admin-inventory.model.js';

// ── GET /suppliers ────────────────────────────────────────────
export const getSuppliersHandler = async (state, c) => {
    try {
        const rows = await inventoryModel.getSuppliers(c);
        state.suppliers = rows;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getSuppliers:', error);
        throw new AppError('Error obteniendo proveedores', 500);
    }
};

// Alias para el registry si usa este nombre
export const getSuppliers = getSuppliersHandler;

// ── POST /suppliers ───────────────────────────────────────────
// El test envía: { code, name, contactName, phone }
// El SP espera:  sp_create_supplier(p_code, p_name, p_contact_info)
export const createSupplier = async (state, c) => {
    const { code, name, contactName } = state.payload;
    try {
        await inventoryModel.createSupplier(c, code, name, contactName ?? null);
        state.message = 'Proveedor creado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in createSupplier:', error);
        throw new AppError('Error creando el proveedor', 500);
    }
};

// ── GET /stock ────────────────────────────────────────────────
// locationCode llega como query param (?location=LOC-COCINA)
export const getStockHandler = async (state, c) => {
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

// Alias legacy
export const getInventoryStock = getStockHandler;

// ── GET /kardex ───────────────────────────────────────────────
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

// ── POST /suppliers/prices ────────────────────────────────────
// El test envía: { supplierCode, itemCode, itemName, itemUnit, price }
// El SP espera:  sp_upsert_supplier_price(p_supplier_code, p_item_code, ...)
export const upsertSupplierPriceHandler = async (state, c) => {
    const { supplierCode, itemCode, itemName, itemUnit, price } = state.payload;
    try {
        await inventoryModel.upsertSupplierPrice(c, supplierCode, itemCode, itemName, itemUnit, price);
        state.message = 'Precio de proveedor actualizado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveSupplierPrice:', error);
        throw new AppError('Error actualizando precio de proveedor', 500);
    }
};

// Alias legacy que también puede estar en el registry
export const saveSupplierPrice = upsertSupplierPriceHandler;

// ── POST /sync  /webhook ──────────────────────────────────────
export const syncPurchasesHandler = async (state, c) => {
    const payload = state.payload;
    if (!payload.supplier || !payload.items || payload.items.length === 0) {
        throw new AppError('El payload no contiene información válida de compras', 400);
    }
    try {
        await inventoryModel.syncPurchases(c, payload);
        state.message = 'Ingesta y sincronización masiva procesada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in syncPurchasesToKardex:', error);
        throw new AppError(`Error en ingesta de datos: ${error.message}`, 500);
    }
};

// ── POST /transfers ───────────────────────────────────────────
export const transferStockHandler = async (state, c) => {
    const { sourceLocation, targetLocation, items } = state.payload;
    if (!items || items.length === 0) throw new AppError('El traspaso no contiene insumos', 400);
    for (const item of items) {
        if (!item.itemCode || item.qty === undefined || item.qty === null) {
            throw new AppError('Faltan campos requeridos en los insumos (itemCode, qty)', 400);
        }
    }
    try {
        for (const item of items) {
            await inventoryModel.transferStock(
                c, item.itemCode, sourceLocation, targetLocation,
                item.qty, null, `TRF-${Date.now()}`
            );
        }
        state.message = 'Traspaso registrado exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveKardexTransfer:', error);
        throw new AppError(`Error en transacción de Kardex: ${error.message}`, 500);
    }
};