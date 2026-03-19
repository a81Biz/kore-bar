// ============================================================
// admin-inventory.test.js
// Módulo: Inventario — Proveedores, Stock y Kardex
// Códigos: INV-xx
// ============================================================
import { describe, it, expect, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Inventario y Proveedores', () => {
    const testSupplier = {
        code: 'PROV-TEST-01',
        name: 'Proveedor de Pruebas S.A.',
        contactName: 'Contacto Prueba'
    };
    const testPricePayload = {
        supplierCode: testSupplier.code,
        itemCode: 'TEST-SAL',
        itemName: 'Sal Fina de Prueba',
        itemUnit: 'KG',
        price: 15.50
    };

    it('INV-01 Crea un proveedor nuevo', async () => {
        const res = await app.request('/api/inventory/suppliers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testSupplier)
        });
        expect(res.status).toBe(200);
    });

    it('INV-02 Devuelve el catálogo de proveedores con sus precios', async () => {
        const res = await app.request('/api/inventory/suppliers', { method: 'GET' });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(Array.isArray(json.data.suppliers)).toBe(true);

        const proveedor = json.data.suppliers.find(p => p.code === testSupplier.code);
        expect(proveedor).toBeDefined();
        expect(proveedor.name).toBe(testSupplier.name);
        expect(Array.isArray(proveedor.prices)).toBe(true);
    });

    it('INV-03 Devuelve el stock actual por insumo', async () => {
        const res = await app.request('/api/inventory/stock', { method: 'GET' });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.stock).toBeDefined();
        expect(Array.isArray(json.data.stock)).toBe(true);
        if (json.data.stock.length > 0) {
            expect(json.data.stock[0]).toHaveProperty('minStock');
        }
    });

    it('INV-04 Devuelve el kardex de movimientos', async () => {
        const res = await app.request('/api/inventory/kardex', { method: 'GET' });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.kardex).toBeDefined();
        expect(Array.isArray(json.data.kardex)).toBe(true);
    });

    it('INV-05 Guarda el precio de un insumo por proveedor', async () => {
        const res = await app.request('/api/inventory/suppliers/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPricePayload)
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    it('INV-06 Rechaza precio si faltan campos requeridos (Gatekeeper 400)', async () => {
        const res = await app.request('/api/inventory/suppliers/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplierCode: testSupplier.code })
        });
        expect(res.status).toBe(400);
    });

    it('INV-07 Registra un ajuste físico (merma a 0)', async () => {
        const res = await app.request('/api/inventory/adjustments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationCode: 'LOC-BODEGA',
                items: [{ itemCode: testPricePayload.itemCode, realStock: 0 }]
            })
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    it('INV-08 Ingesta compras masivamente vía webhook (PUSH)', async () => {
        const res = await app.request('/api/inventory/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplier: { code: 'PRV-SYSCO-TEST', name: 'Sysco Test' },
                destinationLocationCode: 'LOC-BODEGA',
                items: [{
                    itemCode: 'INS-TEQ-TEST',
                    itemName: 'Tequila Test',
                    purchaseUnit: 'Botella',
                    recipeUnit: 'ML',
                    conversionFactor: 700,
                    unitCost: 800.00,
                    quantityPurchased: 10
                }]
            })
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `
            DELETE FROM supplier_prices
            USING suppliers
            WHERE supplier_prices.supplier_id = suppliers.id
              AND suppliers.code IN ($1, 'PRV-SYSCO-TEST')
        `, [testSupplier.code]);

        await executeQuery(null, `DELETE FROM inventory_stock_locations WHERE item_id IN (SELECT id FROM inventory_items WHERE code = 'INS-TEQ-TEST')`);
        await executeQuery(null, `DELETE FROM inventory_kardex          WHERE item_id IN (SELECT id FROM inventory_items WHERE code IN ('INS-TEQ-TEST', $1))`, [testPricePayload.itemCode]);
        await executeQuery(null, `DELETE FROM inventory_items           WHERE code IN ($1, 'INS-TEQ-TEST')`, [testPricePayload.itemCode]);
        await executeQuery(null, `DELETE FROM suppliers                 WHERE code IN ($1, 'PRV-SYSCO-TEST')`, [testSupplier.code]);
    });
});
