// ============================================================
// consumo-teorico.test.js — v4
// Usa ADMIN001 del seed. Mismo patrón SQL que waiter.test.js.
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Inventario — Consumo Teórico y Stock Mínimo', () => {
    const PIN = '123456';

    beforeAll(async () => {
        // PIN de ADMIN001
        await app.request('/api/admin/employees/ADMIN001/reset-pin', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: PIN })
        });

        // Proveedor + Stock via API (estos endpoints funcionan)
        await app.request('/api/inventory/suppliers', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'CONS-PROV', name: 'Proveedor CONS' })
        });
        await app.request('/api/inventory/webhook', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplier: { code: 'CONS-PROV', name: 'Proveedor CONS' },
                referenceId: 'CONS-COMPRA', destinationLocationCode: 'LOC-BODEGA',
                items: [{ itemCode: 'CONS-INS-TOM', itemName: 'Tomate CONS', purchaseUnit: 'KG', recipeUnit: 'KG', conversionFactor: 1, quantityPurchased: 50, unitCost: 25 }]
            })
        });
        await app.request('/api/inventory/transfers', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceLocation: 'LOC-BODEGA', targetLocation: 'LOC-COCINA', items: [{ itemCode: 'CONS-INS-TOM', qty: 20 }] })
        });

        // Zona + Mesa (mismo patrón SQL que waiter.test.js)
        await executeQuery(null, `INSERT INTO restaurant_zones (code, name) VALUES ('CONS-ZONE', 'Zona CONS') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity) VALUES ('CONS-T01', (SELECT id FROM restaurant_zones WHERE code='CONS-ZONE'), 4) ON CONFLICT (code) DO NOTHING`);

        // Categoría + Platillo
        await executeQuery(null, `INSERT INTO menu_categories (code, name) VALUES ('CONS-CAT', 'Cat CONS') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `
            INSERT INTO menu_dishes (code, category_id, name, price, has_recipe, is_active)
            VALUES ('CONS-ENSALADA', (SELECT id FROM menu_categories WHERE code='CONS-CAT'), 'Ensalada CONS', 120, false, true)
            ON CONFLICT (code) DO NOTHING
        `);

        // Receta: 1 ensalada = 0.5 KG tomate
        const [dish] = await executeQuery(null, `SELECT id FROM menu_dishes WHERE code = 'CONS-ENSALADA'`);
        const [ing] = await executeQuery(null, `SELECT id FROM inventory_items WHERE code = 'CONS-INS-TOM'`);
        if (dish && ing) {
            await executeQuery(null, `INSERT INTO dish_recipes (dish_id, item_id, quantity_required) VALUES ($1, $2, 0.5) ON CONFLICT (dish_id, item_id) DO NOTHING`, [dish.id, ing.id]);
            await executeQuery(null, `UPDATE menu_dishes SET has_recipe = true WHERE id = $1`, [dish.id]);
        }

        // Cerrar órdenes previas
        await executeQuery(null, `UPDATE order_headers SET status = 'CLOSED' WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'CONS-T01') AND status IN ('OPEN','AWAITING_PAYMENT')`);
    });

    afterAll(async () => {
        await executeQuery(null, `DELETE FROM order_items WHERE order_id IN (SELECT id FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'CONS-T01'))`);
        await executeQuery(null, `DELETE FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'CONS-T01')`);
        await executeQuery(null, `DELETE FROM dish_recipes WHERE dish_id IN (SELECT id FROM menu_dishes WHERE code = 'CONS-ENSALADA')`);
        await executeQuery(null, `DELETE FROM menu_dishes WHERE code = 'CONS-ENSALADA'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = 'CONS-CAT'`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'CONS-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones WHERE code = 'CONS-ZONE'`);
        await executeQuery(null, `DELETE FROM inventory_kardex WHERE item_id IN (SELECT id FROM inventory_items WHERE code = 'CONS-INS-TOM')`);
        await executeQuery(null, `DELETE FROM inventory_stock_locations WHERE item_id IN (SELECT id FROM inventory_items WHERE code = 'CONS-INS-TOM')`);
        await executeQuery(null, `DELETE FROM supplier_prices WHERE item_id IN (SELECT id FROM inventory_items WHERE code = 'CONS-INS-TOM')`);
        await executeQuery(null, `DELETE FROM inventory_items WHERE code = 'CONS-INS-TOM'`);
        await executeQuery(null, `DELETE FROM suppliers WHERE code = 'CONS-PROV'`);
    });

    it('CONS-01 GET /stock devuelve dailyConsumption = 0 sin órdenes del día', async () => {
        const res = await app.request('/api/inventory/stock?location=LOC-COCINA', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        const stock = json.data?.body?.stock || json.data?.stock || [];
        const item = stock.find(s => s.code === 'CONS-INS-TOM');
        expect(item).toBeDefined();
        expect(parseFloat(item.dailyConsumption)).toBe(0);
    });

    it('CONS-02 Después de enviar 3 ensaladas, dailyConsumption = 1.5', async () => {
        const orderRes = await app.request('/api/waiters/tables/CONS-T01/orders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'ADMIN001',
                items: [{ dishCode: 'CONS-ENSALADA', quantity: 3, notes: '' }]
            })
        });
        expect(orderRes.status).toBe(200);

        const stockRes = await app.request('/api/inventory/stock?location=LOC-COCINA', { method: 'GET' });
        expect(stockRes.status).toBe(200);
        const json = await stockRes.json();
        const stock = json.data?.body?.stock || json.data?.stock || [];
        const item = stock.find(s => s.code === 'CONS-INS-TOM');
        expect(item).toBeDefined();
        console.log(item);
        expect(parseFloat(item.dailyConsumption)).toBeCloseTo(1.5, 2);
    });

    it('CONS-03 POST /suppliers/prices acepta y guarda minimumStock', async () => {
        const res = await app.request('/api/inventory/suppliers/prices', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplierCode: 'CONS-PROV', itemCode: 'CONS-INS-TOM',
                itemName: 'Tomate CONS', itemUnit: 'KG',
                price: 30, minimumStock: 5
            })
        });
        expect(res.status).toBe(200);

        const rows = await executeQuery(null, `SELECT minimum_stock FROM inventory_items WHERE code = 'CONS-INS-TOM'`);
        expect(rows.length).toBe(1);
        expect(parseFloat(rows[0].minimum_stock)).toBe(5);
    });
});