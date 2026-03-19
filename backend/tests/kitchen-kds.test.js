// ============================================================
// kitchen-kds.test.js
// Módulo: KDS — Kitchen Display System
// Códigos: KDS-xx
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo KDS — Tablero de Cocina', () => {
    let testItemId = null;

    // Setup: zona, mesa, empleado, categoría, platillo con receta, orden e item
    beforeAll(async () => {
        await executeQuery(null, `INSERT INTO restaurant_zones  (code, name)                    VALUES ('KDS-ZONE', 'Zona KDS') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity)       VALUES ('KDS-T01', (SELECT id FROM restaurant_zones WHERE code='KDS-ZONE'), 4) ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO menu_categories   (code, name)                    VALUES ('KDS-CAT', 'Cat KDS') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO menu_dishes       (code, category_id, name, price, has_recipe) VALUES ('KDS-DISH', (SELECT id FROM menu_categories WHERE code='KDS-CAT'), 'Platillo KDS', 100, true) ON CONFLICT (code) DO NOTHING`);

        const ordRes = await executeQuery(null, `
            INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total)
            SELECT 'ORD-KDS-TEST', rt.id, e.id, 2, 'OPEN', 100
            FROM restaurant_tables rt CROSS JOIN employees e
            WHERE rt.code = 'KDS-T01' AND e.employee_number = 'ADMIN001'
            ON CONFLICT (code) DO UPDATE SET status = 'OPEN'
            RETURNING id
        `);
        const orderId = ordRes[0]?.id;

        if (orderId) {
            const itemRes = await executeQuery(null, `
                INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status)
                VALUES ($1, (SELECT id FROM menu_dishes WHERE code='KDS-DISH'), 1, 100, 100, 'PENDING_KITCHEN')
                RETURNING id
            `, [orderId]);
            testItemId = itemRes[0]?.id;
        }
    });

    it('KDS-01 Devuelve el tablero Kanban de cocina con grupos pending/preparing/ready', async () => {
        const res = await app.request('/api/kitchen/board', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.board).toBeDefined();
        expect(Array.isArray(json.data.board.pending)).toBe(true);
        expect(Array.isArray(json.data.board.preparing)).toBe(true);
        expect(Array.isArray(json.data.board.ready)).toBe(true);
    });

    it('KDS-02 Avanza item de PENDING_KITCHEN a PREPARING y registra started_at', async () => {
        if (!testItemId) { console.warn('[Skip] Sin item de prueba.'); return; }

        const res = await app.request(`/api/kitchen/items/${testItemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PREPARING' })
        });
        expect(res.status).toBe(200);

        const checkRes = await executeQuery(null, `SELECT status, started_at FROM order_items WHERE id = $1`, [testItemId]);
        expect(checkRes[0].status).toBe('PREPARING');
        expect(checkRes[0].started_at).not.toBeNull();
    });

    it('KDS-03 Avanza item de PREPARING a READY', async () => {
        if (!testItemId) { console.warn('[Skip] Sin item de prueba.'); return; }

        const res = await app.request(`/api/kitchen/items/${testItemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'READY' })
        });
        expect(res.status).toBe(200);

        const checkRes = await executeQuery(null, `SELECT status FROM order_items WHERE id = $1`, [testItemId]);
        expect(checkRes[0].status).toBe('READY');
    });

    it('KDS-04 Rechaza status inválido (Gatekeeper 400)', async () => {
        if (!testItemId) { console.warn('[Skip] Sin item de prueba.'); return; }

        const res = await app.request(`/api/kitchen/items/${testItemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ENTREGADO' })
        });
        expect(res.status).toBe(400);
    });

    it('KDS-05 Devuelve 404 si el item no puede avanzar por flujo incorrecto', async () => {
        if (!testItemId) { console.warn('[Skip] Sin item de prueba.'); return; }

        // El item ya está en READY — intentar pasarlo a PREPARING debe fallar
        const res = await app.request(`/api/kitchen/items/${testItemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PREPARING' })
        });
        expect(res.status).toBe(404);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM order_items   WHERE order_id IN (SELECT id FROM order_headers WHERE code = 'ORD-KDS-TEST')`);
        await executeQuery(null, `DELETE FROM order_headers WHERE code = 'ORD-KDS-TEST'`);
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code = 'KDS-DISH'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = 'KDS-CAT'`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'KDS-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = 'KDS-ZONE'`);
    });
});
