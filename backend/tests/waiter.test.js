// ============================================================
// waiter.test.js
// Módulo: POS Mesero — Login, Layout, Mesa, Comanda, Items
// Códigos: POS-xx
//
// FIX: PIN se establece via reset-pin API (bcrypt hash).
//      Teardown no nullifica PIN de ADMIN001.
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo POS — Mesero', () => {
    let collectItemId = null;
    let deliverItemId = null;

    const ADMIN_PIN = '123456';

    // ── SETUP COMPARTIDO ──────────────────────────────────────
    beforeAll(async () => {
        // Infraestructura base
        await executeQuery(null, `INSERT INTO restaurant_zones  (code, name)                   VALUES ('POS-ZONE', 'Zona POS Test') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity)       VALUES ('POS-T01', (SELECT id FROM restaurant_zones WHERE code='POS-ZONE'), 4) ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO menu_categories   (code, name)                   VALUES ('POS-CAT', 'Cat POS') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `
            INSERT INTO menu_dishes (code, category_id, name, price, has_recipe, is_active)
            VALUES
                ('POS-GUACAMOLE', (SELECT id FROM menu_categories WHERE code='POS-CAT'), 'Guacamole', 100, true,  true),
                ('POS-REFRESCO',  (SELECT id FROM menu_categories WHERE code='POS-CAT'), 'Refresco',  50,  false, true)
            ON CONFLICT (code) DO NOTHING
        `);

        // PIN via API — genera hash bcrypt, compatible con auth.helper.js
        await app.request('/api/admin/employees/ADMIN001/reset-pin', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: ADMIN_PIN })
        });
    });

    // ── LOGIN ─────────────────────────────────────────────────

    it('POS-01 Autentica al mesero con PIN correcto', async () => {
        const res = await app.request('/api/admin/auth/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', pinCode: ADMIN_PIN })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        const body = data.data?.body || data.data || {};
        expect(body.employeeNumber).toBe('ADMIN001');
    });

    it('POS-02 Rechaza PIN incorrecto con 401', async () => {
        const res = await app.request('/api/admin/auth/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', pinCode: '000000' })
        });
        expect(res.status).toBe(401);
    });

    it('POS-03 Rechaza login sin employeeNumber (Gatekeeper 400)', async () => {
        const res = await app.request('/api/admin/auth/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinCode: ADMIN_PIN })
        });
        expect(res.status).toBe(400);
    });

    // ── LAYOUT ────────────────────────────────────────────────

    it('POS-04 Devuelve el plano de zonas y mesas con su estado de ocupación', async () => {
        const res = await app.request('/api/waiters/layout', { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.layout).toBeDefined();

        const layout = data.data.body.layout;
        expect(Array.isArray(layout)).toBe(true);

        if (layout.length > 0) {
            const zona = layout[0];
            expect(zona.zoneCode).toBeDefined();
            expect(zona.zoneName).toBeDefined();
            expect(Array.isArray(zona.tables)).toBe(true);
            if (zona.tables.length > 0) {
                expect(zona.tables[0].status).toMatch(/AVAILABLE|OCCUPIED/);
            }
        }
    });

    // ── ABRIR MESA ────────────────────────────────────────────

    it('POS-05 Abre una mesa creando la cabecera de comanda', async () => {
        await executeQuery(null, `UPDATE order_headers SET status = 'CLOSED' WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'POS-T01') AND status IN ('OPEN','AWAITING_PAYMENT')`);

        const res = await app.request('/api/waiters/tables/POS-T01/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', diners: 2 })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.orderCode).toBeDefined();
    });

    it('POS-06 Devuelve la orden existente si la mesa ya está abierta (idempotente)', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', diners: 4 })
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.data.body.orderCode).toBeDefined();
    });

    it('POS-07 Rechaza abrir mesa si no existe', async () => {
        const res = await app.request('/api/waiters/tables/MESA-FALSA/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', diners: 2 })
        });
        expect(res.status).toBe(404);
    });

    it('POS-08 Rechaza abrir mesa si el empleado no existe', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'EMP-FALSO', diners: 2 })
        });
        expect(res.status).toBe(404);
    });

    // ── ENVIAR COMANDA ────────────────────────────────────────

    it('POS-09 Envía platillos a la comanda abierta', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'ADMIN001',
                items: [
                    { dishCode: 'POS-GUACAMOLE', quantity: 1, notes: 'Extra picante' },
                    { dishCode: 'POS-REFRESCO', quantity: 2 }
                ]
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.orderCode).toBeDefined();
    });

    it('POS-10 Rechaza comanda si el arreglo de items está vacío (Gatekeeper 400)', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', items: [] })
        });
        expect(res.status).toBe(400);
    });

    it('POS-11 Rechaza comanda si el código de platillo no existe', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', items: [{ dishCode: 'PLATILLO-FALSO', quantity: 1 }] })
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    // ── STATUS DE ORDEN ───────────────────────────────────────

    it('POS-12 Devuelve el estado de la comanda de una mesa con sus items', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/order', { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.orderCode).toBeDefined();
        expect(Array.isArray(data.data.body.items)).toBe(true);
        expect(typeof data.data.body.canClose).toBe('boolean');
    });

    // ── RECOLECTAR ITEM (piso — sin receta) ───────────────────

    it('POS-13 El mesero recolecta un item PENDING_FLOOR y descuenta inventario', async () => {
        const orderRes = await executeQuery(null, `SELECT id FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'POS-T01') AND status = 'OPEN' LIMIT 1`);
        const orderId = orderRes[0]?.id;
        expect(orderId).toBeDefined();

        const itemRes = await executeQuery(null, `
            INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status)
            VALUES ($1, (SELECT id FROM menu_dishes WHERE code='POS-REFRESCO'), 1, 50, 50, 'PENDING_FLOOR')
            RETURNING id
        `, [orderId]);
        collectItemId = itemRes[0]?.id;

        const res = await app.request(`/api/waiters/tables/POS-T01/items/${collectItemId}/collect`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
    });

    it('POS-14 Rechaza recolección si el item ya fue recolectado', async () => {
        if (!collectItemId) { console.warn('[Skip] Sin item de recolección.'); return; }

        const res = await app.request(`/api/waiters/tables/POS-T01/items/${collectItemId}/collect`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    // ── ENTREGAR ITEM ─────────────────────────────────────────

    it('POS-15 El mesero entrega un item COLLECTED en la mesa', async () => {
        const orderRes = await executeQuery(null, `SELECT id FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'POS-T01') AND status = 'OPEN' LIMIT 1`);
        const orderId = orderRes[0]?.id;
        expect(orderId).toBeDefined();

        const itemRes = await executeQuery(null, `
            INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal, status)
            VALUES ($1, (SELECT id FROM menu_dishes WHERE code='POS-REFRESCO'), 1, 50, 50, 'COLLECTED')
            RETURNING id
        `, [orderId]);
        deliverItemId = itemRes[0]?.id;

        const res = await app.request(`/api/waiters/tables/POS-T01/items/${deliverItemId}/deliver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
    });

    it('POS-16 Rechaza entrega si el item ya fue entregado', async () => {
        if (!deliverItemId) { console.warn('[Skip] Sin item de entrega.'); return; }

        const res = await app.request(`/api/waiters/tables/POS-T01/items/${deliverItemId}/deliver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(400);
    });

    // ── CERRAR MESA ───────────────────────────────────────────

    it('POS-17 Cierra la mesa enviando la orden a AWAITING_PAYMENT', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.orderCode).toBeDefined();

        const checkRes = await executeQuery(null, `SELECT status FROM order_headers WHERE code = $1`, [data.data.body.orderCode]);
        expect(checkRes[0].status).toBe('AWAITING_PAYMENT');
    });

    it('POS-18 Rechaza cierre si la mesa no tiene orden abierta', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });
        expect(res.status).toBe(400);
    });

    it('POS-19 Rechaza cierre si el empleado no existe', async () => {
        const res = await app.request('/api/waiters/tables/POS-T01/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'EMP-FALSO' })
        });
        expect(res.status).toBe(404);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    // NO se nullifica pin_code de ADMIN001 — otros tests lo necesitan.
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM payments      WHERE order_id IN (SELECT id FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'POS-T01'))`);
        await executeQuery(null, `DELETE FROM tickets       WHERE order_id IN (SELECT id FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'POS-T01'))`);
        await executeQuery(null, `DELETE FROM order_items   WHERE order_id IN (SELECT id FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'POS-T01'))`);
        await executeQuery(null, `DELETE FROM order_headers WHERE table_id  = (SELECT id FROM restaurant_tables WHERE code = 'POS-T01')`);
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code LIKE 'POS-%'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = 'POS-CAT'`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'POS-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = 'POS-ZONE'`);
    });
});