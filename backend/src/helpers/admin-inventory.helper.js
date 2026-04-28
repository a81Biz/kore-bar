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
    const { supplierCode, itemCode, itemName, itemUnit, price, minimumStock } = state.payload;
    try {
        await inventoryModel.upsertSupplierPrice(c, supplierCode, itemCode, itemName, itemUnit, price, minimumStock ?? null);
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
    const orderId = payload.orderId || null;
    try {
        await inventoryModel.syncPurchases(c, payload, orderId);
        state.message = 'Ingesta y sincronización masiva procesada exitosamente';
        if (orderId) state.message += ` Pedido ${orderId} actualizado.`;
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in syncPurchasesToKardex:', error);
        throw new AppError(`Error en ingesta de datos: ${error.message}`, 500);
    }
};

// ── POST /inventory/purchase-orders/:id/items ─────────────────
export const addPurchaseOrderItem = async (state, c) => {
    const orderId = state.params?.id;
    if (!orderId) throw new AppError('El ID del pedido es requerido', 400);
    const { itemCode, supplierCode, qtySuggested, unitPrice, origin } = state.payload;
    if (!itemCode || !qtySuggested) throw new AppError('itemCode y qtySuggested son requeridos', 400);
    try {
        await inventoryModel.addPurchaseOrderItem(
            c, orderId, itemCode, supplierCode, origin || 'ADMIN', qtySuggested, unitPrice
        );
        state.message = `Insumo ${itemCode} agregado al pedido`;
    } catch (error) {
        if (error.isOperational) throw error;
        if (error.message?.includes('null value') || error.message?.includes('violates not-null')) {
            throw new AppError(`Insumo no encontrado: ${itemCode}`, 400);
        }
        throw new AppError(`Error agregando insumo al pedido: ${error.message}`, 500);
    }
};

// ── DELETE /inventory/purchase-orders/:id/items/:lineId ───────
export const removePurchaseOrderItem = async (state, c) => {
    const orderId = state.params?.id;
    const lineId  = state.params?.lineId;
    if (!orderId || !lineId) throw new AppError('ID de pedido y línea son requeridos', 400);
    try {
        await inventoryModel.removePurchaseOrderItem(c, lineId, orderId);
        state.message = 'Línea de pedido eliminada';
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError(`Error eliminando línea: ${error.message}`, 500);
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

// ── GET /inventory/purchase-suggestions ──────────────────────
// Devuelve las purchase_orders en estado DRAFT del día actual
// para que el admin las revise antes de enviarlas.
export const getPurchaseSuggestions = async (state, c) => {
    try {
        const rows = await inventoryModel.getPurchaseSuggestions(c);
        state.data = { orders: rows };
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo sugerencias de compra', 500);
    }
};

// ── POST /inventory/purchase-suggestions/generate ────────────
// Llama a sp_generate_purchase_suggestions.
// El algoritmo detecta items con stock <= minimum_stock,
// selecciona el proveedor más barato (tie: menor lead_time)
// y crea purchase_orders DRAFT agrupadas por proveedor.
export const generatePurchaseSuggestions = async (state, c) => {
    try {
        await inventoryModel.runGeneratePurchaseSuggestions(c);
        // Devolvemos las órdenes recién generadas en la misma respuesta
        const rows = await inventoryModel.getPurchaseSuggestions(c);
        state.data = { orders: rows };
        state.message = `Se generaron sugerencias para ${rows.length} proveedor(es) con stock bajo.`;
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError(`Error generando sugerencias de compra: ${error.message}`, 500);
    }
};

// ── PATCH /inventory/purchase-orders/:id/send ────────────────
// Marca una purchase_order como SENT (pedido enviado al proveedor).
// En producción este endpoint dispararía el email/webhook al proveedor.
export const sendPurchaseOrder = async (state, c) => {
    const { id } = state.params;
    if (!id) throw new AppError('El ID de la orden es requerido', 400);
    try {
        await inventoryModel.updatePurchaseOrderStatus(c, id, 'SENT');
        state.message = 'Pedido marcado como enviado al proveedor.';
    } catch (error) {
        if (error.code === 'P0002' || error.message?.includes('no encontrada')) {
            throw new AppError(`Orden de compra no encontrada: ${id}`, 404);
        }
        if (error.isOperational) throw error;
        throw new AppError('Error actualizando estado de la orden', 500);
    }
};