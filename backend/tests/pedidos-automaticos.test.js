// ============================================================
// pedidos-automaticos.test.js
// Módulo: Pedidos Automáticos a Proveedores
// Códigos: PED-xx
//
// Flujo cubierto:
//   1. Setup: proveedor + insumo con stock bajo
//   2. Generar sugerencias via POST /inventory/purchase-suggestions/generate
//   3. Consultar sugerencias via GET  /inventory/purchase-suggestions
//   4. Confirmar pedido   via PATCH /inventory/purchase-orders/:id/send
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Inventario — Pedidos Automáticos a Proveedores', () => {

    const TEST_SUPPLIER_CODE = 'PRV-PED-TEST-01';
    const TEST_ITEM_CODE     = 'INS-PED-TEST-01';
    const TEST_ITEM_CODE_B   = 'INS-PED-TEST-02';  // Para test de desempate de lead_time

    // ── SETUP ─────────────────────────────────────────────────
    // Proveedor + insumo con stock=0 y minimum_stock=10 → debe generar sugerencia
    beforeAll(async () => {
        // 1. Proveedor de prueba via API
        await app.request('/api/inventory/suppliers', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code:        TEST_SUPPLIER_CODE,
                name:        'Proveedor Pedidos Test',
                contactName: 'Test Contact'
            })
        });

        // 2. Insumo con minimum_stock=10 via webhook de compras (crea el item)
        await app.request('/api/inventory/webhook', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplier: { code: TEST_SUPPLIER_CODE, name: 'Proveedor Pedidos Test' },
                destinationLocationCode: 'LOC-BODEGA',
                items: [{
                    itemCode:          TEST_ITEM_CODE,
                    itemName:          'Insumo Pedido Test',
                    purchaseUnit:      'KG',
                    recipeUnit:        'GR',
                    conversionFactor:  1000,
                    unitCost:          25.00,
                    quantityPurchased: 0    // stock en 0 para forzar sugerencia
                }]
            })
        });

        // 3. Fijar minimum_stock=10 directamente (el webhook no lo expone)
        await executeQuery(null, `
            UPDATE inventory_items SET minimum_stock = 10 WHERE code = $1
        `, [TEST_ITEM_CODE]);

        // 4. Asegurar stock=0 en bodega para este insumo
        await executeQuery(null, `
            UPDATE inventory_stock_locations
            SET stock = 0
            WHERE item_id  = (SELECT id FROM inventory_items WHERE code = $1)
              AND location_id = (SELECT id FROM inventory_locations WHERE code = 'LOC-BODEGA')
        `, [TEST_ITEM_CODE]);

        // 5. Vincular precio proveedor con lead_time_days
        await app.request('/api/inventory/suppliers/prices', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplierCode: TEST_SUPPLIER_CODE,
                itemCode:     TEST_ITEM_CODE,
                itemName:     'Insumo Pedido Test',
                itemUnit:     'KG',
                price:        25.00
            })
        });

        // 6. Actualizar lead_time_days directamente (el endpoint no lo expone aún)
        await executeQuery(null, `
            UPDATE supplier_prices
            SET lead_time_days = 2
            WHERE supplier_id = (SELECT id FROM suppliers WHERE code = $1)
              AND item_id     = (SELECT id FROM inventory_items WHERE code = $2)
        `, [TEST_SUPPLIER_CODE, TEST_ITEM_CODE]);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        // Limpiar purchase_order_items → purchase_orders
        await executeQuery(null, `
            DELETE FROM purchase_order_items
            WHERE order_id IN (
                SELECT po.id FROM purchase_orders po
                JOIN suppliers s ON s.id = po.supplier_id
                WHERE s.code = $1
            )
        `, [TEST_SUPPLIER_CODE]);
        await executeQuery(null, `
            DELETE FROM purchase_orders
            WHERE supplier_id = (SELECT id FROM suppliers WHERE code = $1)
        `, [TEST_SUPPLIER_CODE]);
        await executeQuery(null, `
            DELETE FROM supplier_prices
            WHERE supplier_id = (SELECT id FROM suppliers WHERE code = $1)
        `, [TEST_SUPPLIER_CODE]);
        await executeQuery(null, `
            DELETE FROM inventory_stock_locations
            WHERE item_id IN (SELECT id FROM inventory_items WHERE code IN ($1, $2))
        `, [TEST_ITEM_CODE, TEST_ITEM_CODE_B]);
        await executeQuery(null, `
            DELETE FROM inventory_kardex
            WHERE item_id IN (SELECT id FROM inventory_items WHERE code IN ($1, $2))
        `, [TEST_ITEM_CODE, TEST_ITEM_CODE_B]);
        await executeQuery(null, `
            DELETE FROM inventory_items WHERE code IN ($1, $2)
        `, [TEST_ITEM_CODE, TEST_ITEM_CODE_B]);
        await executeQuery(null, `
            DELETE FROM suppliers WHERE code = $1
        `, [TEST_SUPPLIER_CODE]);
    });


    // ═══════════════════════════════════════════════════════════
    // POST /inventory/purchase-suggestions/generate
    // ═══════════════════════════════════════════════════════════

    it('PED-01 Genera sugerencias de compra y devuelve 200 con orders', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions/generate', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({})
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.orders)).toBe(true);
    });

    it('PED-02 El insumo con stock=0 y minimum_stock=10 genera una sugerencia', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions/generate', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({})
        });

        const json = await res.json();
        const allItems = json.data.orders.flatMap(o => o.items);
        const found = allItems.find(i => i.itemCode === TEST_ITEM_CODE);
        expect(found).toBeDefined();
    });

    it('PED-03 La cantidad sugerida es (minimum_stock*2) - stock_actual = 20', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const json = await res.json();
        const allItems = json.data.orders.flatMap(o => o.items);
        const item = allItems.find(i => i.itemCode === TEST_ITEM_CODE);
        expect(item).toBeDefined();
        // minimum_stock=10, stock=0 → qty = (10*2) - 0 = 20
        expect(Number(item.qtySuggested)).toBe(20);
    });

    it('PED-04 El precio de la sugerencia coincide con supplier_prices', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const json = await res.json();
        const allItems = json.data.orders.flatMap(o => o.items);
        const item = allItems.find(i => i.itemCode === TEST_ITEM_CODE);
        expect(Number(item.unitPrice)).toBe(25.00);
    });

    it('PED-05 Es idempotente: ejecutar dos veces no duplica la orden del día', async () => {
        await app.request('/api/inventory/purchase-suggestions/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const check = await executeQuery(null, `
            SELECT COUNT(*) AS total
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE s.code = $1
              AND DATE(po.generated_at) = CURRENT_DATE
              AND po.status = 'DRAFT'
        `, [TEST_SUPPLIER_CODE]);
        // Solo debe haber 1 orden DRAFT por proveedor por día
        expect(parseInt(check[0].total)).toBe(1);
    });

    it('PED-06 El mensaje de respuesta incluye la cantidad de proveedores', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const json = await res.json();
        expect(json.message).toBeDefined();
        expect(json.message.length).toBeGreaterThan(0);
    });


    // ═══════════════════════════════════════════════════════════
    // GET /inventory/purchase-suggestions
    // ═══════════════════════════════════════════════════════════

    it('PED-07 GET devuelve 200 con la lista de órdenes DRAFT del día', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions', {
            method: 'GET'
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.orders)).toBe(true);
    });

    it('PED-08 Cada orden tiene supplierCode, supplierName, totalAmount e items', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions', { method: 'GET' });
        const json = await res.json();

        const order = json.data.orders.find(o => o.supplierCode === TEST_SUPPLIER_CODE);
        expect(order).toBeDefined();
        expect(order).toHaveProperty('supplierCode');
        expect(order).toHaveProperty('supplierName');
        expect(order).toHaveProperty('totalAmount');
        expect(order).toHaveProperty('items');
        expect(Array.isArray(order.items)).toBe(true);
    });

    it('PED-09 Las líneas tienen itemCode, qtySuggested, unitPrice y leadTimeDays', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions', { method: 'GET' });
        const json = await res.json();
        const order = json.data.orders.find(o => o.supplierCode === TEST_SUPPLIER_CODE);
        const item = order?.items?.[0];
        expect(item).toBeDefined();
        expect(item).toHaveProperty('itemCode');
        expect(item).toHaveProperty('qtySuggested');
        expect(item).toHaveProperty('unitPrice');
        expect(item).toHaveProperty('leadTimeDays');
    });

    it('PED-10 totalAmount es la suma de (qtySuggested * unitPrice) de sus líneas', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions', { method: 'GET' });
        const json = await res.json();
        const order = json.data.orders.find(o => o.supplierCode === TEST_SUPPLIER_CODE);

        const calculatedTotal = order.items.reduce(
            (sum, i) => sum + (Number(i.qtySuggested) * Number(i.unitPrice)), 0
        );
        expect(Number(order.totalAmount)).toBeCloseTo(calculatedTotal, 2);
    });


    // ═══════════════════════════════════════════════════════════
    // PATCH /inventory/purchase-orders/:id/send
    // ═══════════════════════════════════════════════════════════

    it('PED-11 Marca una orden como SENT y devuelve 200', async () => {
        // Obtener el ID de la orden DRAFT del proveedor de prueba
        const ordersRes = await app.request('/api/inventory/purchase-suggestions', { method: 'GET' });
        const ordersJson = await ordersRes.json();
        const order = ordersJson.data.orders.find(o => o.supplierCode === TEST_SUPPLIER_CODE);
        expect(order).toBeDefined();

        const res = await app.request(`/api/inventory/purchase-orders/${order.orderId}/send`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    it('PED-12 Tras PATCH send, el status en BD es SENT', async () => {
        const check = await executeQuery(null, `
            SELECT po.status
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE s.code = $1
              AND DATE(po.generated_at) = CURRENT_DATE
        `, [TEST_SUPPLIER_CODE]);
        expect(check[0].status).toBe('SENT');
    });

    it('PED-13 Devuelve 404 al intentar enviar un UUID inexistente', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res = await app.request(`/api/inventory/purchase-orders/${fakeId}/send`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.success).toBe(false);
    });

    it('PED-14 La orden SENT sigue apareciendo en GET purchase-suggestions (status SENT visible)', async () => {
        const res = await app.request('/api/inventory/purchase-suggestions', { method: 'GET' });
        const json = await res.json();
        const order = json.data.orders.find(o => o.supplierCode === TEST_SUPPLIER_CODE);
        // La query devuelve status IN ('DRAFT', 'SENT')
        expect(order).toBeDefined();
        expect(order.status).toBe('SENT');
    });

    it('PED-15 Un insumo con stock mayor al minimum_stock NO genera sugerencia', async () => {
        // Subir el stock del insumo de prueba por encima del mínimo
        await executeQuery(null, `
            UPDATE inventory_stock_locations
            SET stock = 50
            WHERE item_id  = (SELECT id FROM inventory_items WHERE code = $1)
              AND location_id = (SELECT id FROM inventory_locations WHERE code = 'LOC-BODEGA')
        `, [TEST_ITEM_CODE]);

        // Limpiar la orden DRAFT/SENT existente para que el SP pueda re-evaluar
        await executeQuery(null, `
            DELETE FROM purchase_order_items
            WHERE order_id IN (
                SELECT po.id FROM purchase_orders po
                JOIN suppliers s ON s.id = po.supplier_id
                WHERE s.code = $1 AND DATE(po.generated_at) = CURRENT_DATE
            )
        `, [TEST_SUPPLIER_CODE]);
        await executeQuery(null, `
            DELETE FROM purchase_orders
            WHERE supplier_id = (SELECT id FROM suppliers WHERE code = $1)
              AND DATE(generated_at) = CURRENT_DATE
        `, [TEST_SUPPLIER_CODE]);

        const res = await app.request('/api/inventory/purchase-suggestions/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const json = await res.json();
        const allItems = json.data.orders.flatMap(o => o.items);
        const found = allItems.find(i => i.itemCode === TEST_ITEM_CODE);
        // Stock=50 > minimum_stock=10 → no debe aparecer en sugerencias
        expect(found).toBeUndefined();
    });
});
