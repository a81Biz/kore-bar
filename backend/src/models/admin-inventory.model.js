import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── PROVEEDORES ───────────────────────────────────────────────

export const createSupplier = async (c, code, name, contactInfo) =>
    await executeStoredProcedure(c, 'sp_create_supplier', {
        p_code: code,
        p_name: name,
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
        p_item_code: itemCode,
        p_item_name: itemName,
        p_item_unit: itemUnit,
        p_price: price
    });

// ── COMPRAS ───────────────────────────────────────────────────

export const syncPurchases = async (c, payload) =>
    await executeStoredProcedure(c, 'sp_sync_purchases', { p_payload: payload }, { p_payload: 'JSONB' });

// ── STOCK / INVENTARIO ────────────────────────────────────────

export const getStockSummary = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_stock_summary`);

// Alias con camelCase requerido por el helper y el test (INV-03 verifica 'minStock')
export const getInventoryStock = async (c, locationCode = null) =>
    await executeQuery(c, `
        SELECT code,
               name,
               unit_measure      AS "unitMeasure",
               recipe_unit       AS "recipeUnit",
               minimum_stock     AS "minStock",
               total_stock       AS "totalStock",
               by_location       AS "byLocation"
        FROM vw_stock_summary
    `);

// ── KARDEX ────────────────────────────────────────────────────

export const getInventoryItems = async (c) =>
    await executeQuery(c, `
        SELECT id, code, name, unit_measure AS "unitMeasure",
               recipe_unit AS "recipeUnit", minimum_stock AS "minimumStock",
               is_active AS "isActive"
        FROM inventory_items
        WHERE is_active = true
        ORDER BY name ASC
    `);

export const getLocations = async (c) =>
    await executeQuery(c, `
        SELECT id, code, name, type
        FROM inventory_locations
        ORDER BY name ASC
    `);

// Consulta del libro mayor — filtrable por ubicación e insumo
export const getKardex = async (c, locationCode = null, itemCode = null) => {
    const conditions = [];
    const params = [];

    if (locationCode) {
        params.push(locationCode);
        conditions.push(`(il_from.code = $${params.length} OR il_to.code = $${params.length})`);
    }
    if (itemCode) {
        params.push(itemCode);
        conditions.push(`ii.code = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return await executeQuery(c, `
        SELECT k.id,
               ii.code         AS "itemCode",
               ii.name         AS "itemName",
               k.transaction_type AS "transactionType",
               k.quantity,
               k.reference_id  AS "referenceId",
               k.date,
               il_from.code    AS "fromLocation",
               il_to.code      AS "toLocation"
        FROM inventory_kardex k
        JOIN inventory_items ii ON ii.id = k.item_id
        LEFT JOIN inventory_locations il_from ON il_from.id = k.from_location_id
        LEFT JOIN inventory_locations il_to   ON il_to.id   = k.to_location_id
        ${where}
        ORDER BY k.date DESC
        LIMIT 200
    `, params);
};

export const transferStock = async (c, itemCode, fromCode, toCode, qty, userId, ref) =>
    await executeStoredProcedure(c, 'sp_kardex_transfer', {
        p_item_code: itemCode,
        p_from_location_code: fromCode,
        p_to_location_code: toCode,
        p_base_qty: qty,
        p_user_id: userId ?? '00000000-0000-0000-0000-000000000000',
        p_reference_id: ref
    }, { p_user_id: 'UUID' });

export const adjustStock = async (c, locationCode, itemCode, physicalStock, note) =>
    await executeStoredProcedure(c, 'sp_kardex_adjustment', {
        p_location_code: locationCode,
        p_item_code: itemCode,
        p_physical_stock: physicalStock,
        p_note: note
    });