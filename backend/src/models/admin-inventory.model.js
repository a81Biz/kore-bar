import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── PROVEEDORES ───────────────────────────────────────────────

export const createSupplier = async (c, code, name, contactInfo) =>
    await executeStoredProcedure(c, 'sp_create_supplier', {
        p_code:         code,
        p_name:         name,
        p_contact_info: contactInfo
    });

export const getSuppliers = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_suppliers_with_prices ORDER BY name ASC`);

export const getSupplierByCode = async (c, code) => {
    const res = await executeQuery(c, `
        SELECT * FROM vw_suppliers_with_prices WHERE code = $1
    `, [code]);
    return res[0] ?? null;
};

// ── PRECIOS ───────────────────────────────────────────────────

export const upsertSupplierPrice = async (c, supplierCode, itemCode, itemName, itemUnit, price) =>
    await executeStoredProcedure(c, 'sp_upsert_supplier_price', {
        p_supplier_code: supplierCode,
        p_item_code:     itemCode,
        p_item_name:     itemName,
        p_item_unit:     itemUnit,
        p_price:         price
    });

// ── COMPRAS ───────────────────────────────────────────────────

export const syncPurchases = async (c, payload) =>
    await executeStoredProcedure(c, 'sp_sync_purchases', { p_payload: payload }, { p_payload: 'JSONB' });

// ── STOCK / INVENTARIO ────────────────────────────────────────

export const getStockSummary = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_stock_summary`);

export const getInventoryItems = async (c) =>
    await executeQuery(c, `
        SELECT id, code, name, unit_measure AS "unitMeasure",
               recipe_unit AS "recipeUnit", minimum_stock AS "minimumStock",
               is_active AS "isActive"
        FROM inventory_items
        WHERE is_active = true
        ORDER BY name ASC
    `);

// ── LOCACIONES ────────────────────────────────────────────────

export const getLocations = async (c) =>
    await executeQuery(c, `
        SELECT id, code, name, type, is_active AS "isActive"
        FROM inventory_locations
        WHERE is_active = true
        ORDER BY name ASC
    `);

// ── KARDEX ────────────────────────────────────────────────────

export const transferStock = async (c, itemCode, fromCode, toCode, qty, userId, ref) =>
    await executeStoredProcedure(c, 'sp_kardex_transfer', {
        p_item_code:          itemCode,
        p_from_location_code: fromCode,
        p_to_location_code:   toCode,
        p_base_qty:           qty,
        p_user_id:            userId,
        p_reference_id:       ref
    }, { p_user_id: 'UUID' });

export const adjustStock = async (c, locationCode, itemCode, physicalStock, note) =>
    await executeStoredProcedure(c, 'sp_kardex_adjustment', {
        p_location_code:  locationCode,
        p_item_code:      itemCode,
        p_physical_stock: physicalStock,
        p_note:           note
    });
