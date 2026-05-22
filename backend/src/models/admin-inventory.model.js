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

export const upsertSupplierPrice = async (c, supplierCode, itemCode, itemName, itemUnit, price, minimumStock = null) =>
    await executeStoredProcedure(c, 'sp_upsert_supplier_price', {
        p_supplier_code: supplierCode,
        p_item_code: itemCode,
        p_item_name: itemName,
        p_item_unit: itemUnit,
        p_price: price,
        p_minimum_stock: minimumStock
    });

// ── COMPRAS ───────────────────────────────────────────────────

export const syncPurchases = async (c, payload, orderId = null) => {
    const params = { p_payload: payload };
    const types  = { p_payload: 'JSONB' };
    if (orderId) {
        params.p_order_id = orderId;
        types.p_order_id  = 'UUID';
    }
    return await executeStoredProcedure(c, 'sp_sync_purchases', params, types);
};

// ── STOCK / INVENTARIO ────────────────────────────────────────

export const getStockSummary = async (c) =>
    await executeQuery(c, `SELECT * FROM vw_stock_summary`);

// Ahora cada llamada recibe solo los items que tienen stock en esa ubicación.
// El frontend hace dos llamadas independientes:
//   fetchData(`${ENDPOINTS.inventory.get.stock}?location=LOC-BODEGA`)
//   fetchData(`${ENDPOINTS.inventory.get.stock}?location=LOC-COCINA`)
export const getInventoryStock = async (c, locationCode = null) => {
    const params = [];
    const conditions = ['ii.is_active = true'];

    if (locationCode) {
        params.push(locationCode);
        conditions.push(`il.code = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    return await executeQuery(c, `
        SELECT
            ii.code,
            ii.name,
            ii.unit_measure              AS "unitMeasure",
            ii.recipe_unit               AS "recipeUnit",
            ii.minimum_stock             AS "minStock",
            ii.conversion_factor         AS "conversionFactor",
            COALESCE(isl.stock, 0)       AS "totalStock",
            COALESCE(isl.stock, 0)       AS "stock",
            il.code                      AS "locationCode",
            COALESCE(dtc.theoretical_qty, 0) AS "dailyConsumption"
        FROM inventory_items ii
        JOIN inventory_stock_locations isl ON isl.item_id    = ii.id
        JOIN inventory_locations il        ON il.id          = isl.location_id
        LEFT JOIN vw_daily_theoretical_consumption dtc ON dtc.item_id = ii.id
        WHERE ${where}
        ORDER BY ii.name ASC
    `, params);
};

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

// ── GET /inventory/purchase-suggestions ──────────────────────
// Devuelve purchase_orders con sus líneas de detalle en JSONB.
// El proveedor de cabecera viene de po.supplier_id; el de cada línea de poi.supplier_id.
export const getPurchaseSuggestions = async (c) =>
    await executeQuery(c, `
        SELECT
            po.id               AS "orderId",
            po.status,
            po.total_amount     AS "totalAmount",
            po.generated_at     AS "generatedAt",
            po.notes,
            ps.code             AS "supplierCode",
            ps.name             AS "supplierName",
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'lineId',        poi.id,
                        'itemCode',      ii.code,
                        'itemName',      ii.name,
                        'supplierCode',  ls.code,
                        'supplierName',  ls.name,
                        'origin',        poi.origin,
                        'qtySuggested',  poi.qty_suggested,
                        'qtyDelivered',  poi.qty_delivered,
                        'unitPrice',     poi.unit_price,
                        'leadTimeDays',  poi.lead_time_days,
                        'lineTotal',     ROUND(poi.qty_suggested * poi.unit_price, 2),
                        'difference',    ROUND(poi.qty_suggested - poi.qty_delivered, 4)
                    ) ORDER BY poi.origin, ii.name
                ) FILTER (WHERE poi.id IS NOT NULL),
                '[]'::jsonb
            )                   AS items
        FROM  purchase_orders po
        LEFT JOIN suppliers ps        ON ps.id  = po.supplier_id
        LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
        LEFT JOIN inventory_items ii  ON ii.id  = poi.item_id
        LEFT JOIN suppliers ls        ON ls.id  = poi.supplier_id
        WHERE po.status IN ('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED')
        GROUP BY po.id, po.status, po.total_amount, po.generated_at, po.notes, ps.code, ps.name
        ORDER BY po.generated_at DESC
        LIMIT 100
    `);


// ── POST /inventory/purchase-suggestions/generate ────────────
export const runGeneratePurchaseSuggestions = async (c) =>
    await executeQuery(c, `CALL sp_generate_purchase_suggestions()`);

// ── POST /inventory/purchase-orders/:id/items ─────────────────
export const addPurchaseOrderItem = async (c, orderId, itemCode, supplierCode, origin, qtySuggested, unitPrice) => {
    const rows = await executeQuery(c, `
        INSERT INTO purchase_order_items (
            order_id, item_id, supplier_id, origin, qty_suggested, unit_price
        )
        SELECT $1,
               (SELECT id FROM inventory_items WHERE code = $2),
               (SELECT id FROM suppliers       WHERE code = $3),
               $4, $5, $6
        ON CONFLICT (order_id, item_id) DO UPDATE SET
            qty_suggested = EXCLUDED.qty_suggested,
            unit_price    = EXCLUDED.unit_price,
            supplier_id   = EXCLUDED.supplier_id
        RETURNING id
    `, [orderId, itemCode, supplierCode || null, origin || 'ADMIN', qtySuggested, unitPrice || 0]);

    await executeQuery(c, `
        UPDATE purchase_orders
        SET total_amount = COALESCE(
                (SELECT SUM(qty_suggested * unit_price)
                 FROM purchase_order_items WHERE order_id = $1), 0),
            updated_at = NOW()
        WHERE id = $1
    `, [orderId]);

    return rows;
};

// ── DELETE /inventory/purchase-orders/:id/items/:lineId ───────
export const removePurchaseOrderItem = async (c, lineId, orderId) => {
    await executeQuery(c, `
        DELETE FROM purchase_order_items WHERE id = $1 AND order_id = $2
    `, [lineId, orderId]);

    await executeQuery(c, `
        UPDATE purchase_orders
        SET total_amount = COALESCE(
                (SELECT SUM(qty_suggested * unit_price)
                 FROM purchase_order_items WHERE order_id = $1), 0),
            updated_at = NOW()
        WHERE id = $1
    `, [orderId]);
};


// ── PATCH /inventory/purchase-orders/:id/send ────────────────
// Actualiza el status de una purchase_order a SENT.
// Si el UUID no existe, lanza error con code P0002 para que
// el helper lo traduzca a 404.
export const updatePurchaseOrderStatus = async (c, orderId, status) => {
    const rows = await executeQuery(c, `
        UPDATE purchase_orders
        SET    status     = $1,
               updated_at = NOW()
        WHERE  id = $2
        RETURNING id
    `, [status, orderId]);

    if (!rows || rows.length === 0) {
        const err = new Error(`Orden de compra no encontrada: ${orderId}`);
        err.code = 'P0002';
        throw err;
    }
    return rows;
};