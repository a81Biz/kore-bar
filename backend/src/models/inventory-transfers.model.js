import { executeStoredProcedure } from '../db/connection.js';

export const kardexTransfer = async (c, itemCode, fromLocation, toLocation, qty, referenceId) =>
    await executeStoredProcedure(c, 'sp_kardex_transfer', {
        p_item_code: itemCode,
        p_from_location_code: fromLocation,
        p_to_location_code: toLocation,
        p_base_qty: qty,
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_reference_id: referenceId
    });

export const syncPurchases = async (c, payload) =>
    await executeStoredProcedure(c, 'sp_sync_purchases', {
        p_payload: JSON.stringify(payload)
    });

export const kardexAdjustment = async (c, locationCode, itemCode, realStock, note) =>
    await executeStoredProcedure(c, 'sp_kardex_adjustment', {
        p_location_code: locationCode,
        p_item_code: itemCode,
        p_physical_stock: realStock,
        p_note: note || 'Toma Física'
    });