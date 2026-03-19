// ============================================================
// inventory-transfers.test.js
// Módulo: Inventario — Traspasos y Kardex
// Códigos: TRF-xx
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Inventario — Traspasos y Kardex', () => {
    const TEST_ITEM_CODE = 'INS-TEQUILA-TRF';

    beforeAll(async () => {
        await executeQuery(null, `
            INSERT INTO inventory_locations (code, name, type) VALUES
                ('LOC-BODEGA', 'Bodega Principal', 'BODEGA'),
                ('LOC-COCINA', 'Cocina', 'OPERATION')
            ON CONFLICT (code) DO NOTHING
        `);
        await executeQuery(null, `
            INSERT INTO inventory_items (code, name, unit_measure, conversion_factor)
            VALUES ($1, 'Tequila de Prueba TDD', 'Caja', 1.0)
            ON CONFLICT (code) DO NOTHING
        `, [TEST_ITEM_CODE]);
        await executeQuery(null, `
            INSERT INTO inventory_stock_locations (item_id, location_id, stock)
            SELECT i.id, l.id, 10
            FROM inventory_items i, inventory_locations l
            WHERE i.code = $1 AND l.code = 'LOC-BODEGA'
            ON CONFLICT (item_id, location_id) DO UPDATE SET stock = 10
        `, [TEST_ITEM_CODE]);
    });

    it('TRF-01 Rechaza traspaso sin `targetLocation` (Gatekeeper 400)', async () => {
        const res = await app.request('/api/inventory/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceLocation: 'LOC-BODEGA',
                items: [{ itemCode: TEST_ITEM_CODE, qty: 1 }]
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('Faltan campos requeridos');
    });

    it('TRF-02 Rechaza traspaso con items sin `qty` (Gatekeeper 400)', async () => {
        const res = await app.request('/api/inventory/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceLocation: 'LOC-BODEGA',
                targetLocation: 'LOC-COCINA',
                items: [{ itemCode: TEST_ITEM_CODE }]
            })
        });
        expect(res.status).toBe(400);
    });

    it('TRF-03 Rechaza traspaso si no hay stock suficiente en origen', async () => {
        const res = await app.request('/api/inventory/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceLocation: 'LOC-BODEGA',
                targetLocation: 'LOC-COCINA',
                items: [{ itemCode: TEST_ITEM_CODE, qty: 999 }]
            })
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('TRF-04 Ejecuta el traspaso correctamente y actualiza kardex', async () => {
        const res = await app.request('/api/inventory/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceLocation: 'LOC-BODEGA',
                targetLocation: 'LOC-COCINA',
                items: [{ itemCode: TEST_ITEM_CODE, qty: 1 }]
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);

        // Verificar que el kardex registró el movimiento
        const kardexRes = await executeQuery(null, `
            SELECT transaction_type, quantity
            FROM inventory_kardex
            WHERE item_id = (SELECT id FROM inventory_items WHERE code = $1)
              AND transaction_type = 'TRANSFER'
            ORDER BY date DESC LIMIT 1
        `, [TEST_ITEM_CODE]);
        expect(kardexRes.length).toBeGreaterThan(0);
        expect(kardexRes[0].transaction_type).toBe('TRANSFER');
    });

    it('TRF-05 Verifica que el stock en bodega disminuyó y en cocina aumentó', async () => {
        const bodega = await executeQuery(null, `
            SELECT sl.stock FROM inventory_stock_locations sl
            JOIN inventory_items ii ON ii.id = sl.item_id
            JOIN inventory_locations il ON il.id = sl.location_id
            WHERE ii.code = $1 AND il.code = 'LOC-BODEGA'
        `, [TEST_ITEM_CODE]);
        expect(Number(bodega[0].stock)).toBe(9);

        const cocina = await executeQuery(null, `
            SELECT sl.stock FROM inventory_stock_locations sl
            JOIN inventory_items ii ON ii.id = sl.item_id
            JOIN inventory_locations il ON il.id = sl.location_id
            WHERE ii.code = $1 AND il.code = 'LOC-COCINA'
        `, [TEST_ITEM_CODE]);
        expect(Number(cocina[0].stock)).toBeGreaterThan(0);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM inventory_stock_locations WHERE item_id IN (SELECT id FROM inventory_items WHERE code = $1)`, [TEST_ITEM_CODE]);
        await executeQuery(null, `DELETE FROM inventory_kardex          WHERE item_id IN (SELECT id FROM inventory_items WHERE code = $1)`, [TEST_ITEM_CODE]);
        await executeQuery(null, `DELETE FROM inventory_items           WHERE code = $1`, [TEST_ITEM_CODE]);
    });
});
