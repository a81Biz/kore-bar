import { executeQuery, executeStoredProcedure } from '../db/connection.js';

export const getSuppliers = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_suppliers_with_prices ORDER BY code ASC`);

export const createSupplier = async (c, { code, name, contactName, phone }) => {
    const contactInfo = [contactName, phone ? `Tel: ${phone}` : ''].filter(Boolean).join(' | ');
    return await executeQuery(c, `
        INSERT INTO suppliers (code, name, contact_info) VALUES ($1, $2, $3)
    `, [code, name, contactInfo]);
};

export const getInventoryStock = async (c, locationCode) =>
    await executeQuery(c, `
        SELECT
            i.code,
            i.name,
            i.unit_measure  AS unit,
            i.recipe_unit,
            COALESCE(sl.stock, 0) AS stock,
            i.minimum_stock AS "minStock"
        FROM inventory_items i
        LEFT JOIN inventory_locations l         ON l.code = $1
        LEFT JOIN inventory_stock_locations sl  ON sl.item_id = i.id AND sl.location_id = l.id
        WHERE i.is_active = true
        ORDER BY i.name
    `, [locationCode || null]);

export const getKardex = async (c, locationCode, itemCode) =>
    await executeQuery(c, `
        SELECT
            i.name  AS ingredient,
            i.code  AS item_code,
            k.transaction_type AS type,
            k.quantity,
            k.reference_id     AS reference,
            k.date,
            fl.code AS origin,
            tl.code AS dest
        FROM inventory_kardex k
        JOIN inventory_items i          ON k.item_id = i.id
        LEFT JOIN inventory_locations fl ON fl.id = k.from_location_id
        LEFT JOIN inventory_locations tl ON tl.id = k.to_location_id
        WHERE ($1::text IS NULL OR fl.code = $1 OR tl.code = $1)
          AND ($2::text IS NULL OR upper(i.name) LIKE '%' || upper($2) || '%'
                                OR upper(i.code) LIKE '%' || upper($2) || '%')
        ORDER BY k.date DESC
        LIMIT 50
    `, [locationCode || null, itemCode || null]);

// FIX: p_supplier_id → p_supplier_code para que coincida con el SP
export const upsertSupplierPrice = async (c, payload) =>
    await executeStoredProcedure(c, 'sp_upsert_supplier_price', {
        p_supplier_code: payload.supplierCode,
        p_item_code: payload.itemCode,
        p_item_name: payload.itemName,
        p_item_unit: payload.itemUnit,
        p_price: payload.price
    });