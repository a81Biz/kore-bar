// ============================================================
// e2e-operacion.test.js
// Prueba E2E: Flujo operativo completo de un turno
// Códigos: E2E-xx
//
// FIX: PIN se establece via reset-pin API (bcrypt hash).
//      Teardown no nullifica PIN de ADMIN001.
//      Setup de infraestructura via API (no INSERT directo a tablas de negocio).
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('E2E — Operación Completa de un Turno', () => {
    let orderCode = null;
    let itemId = null;
    let ticketFolio = null;

    const E2E_ZONE = 'E2E-ZONE';
    const E2E_TABLE = 'E2E-T01';
    const E2E_CAT = 'E2E-CAT';
    const E2E_DISH = 'E2E-TACO';
    const ADMIN_PIN = '123456';

    beforeAll(async () => {
        // Infraestructura via API (idempotente)
        await app.request('/api/admin/zones', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: E2E_ZONE, name: 'Zona E2E' })
        });
        await app.request('/api/admin/tables', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: E2E_TABLE, zoneCode: E2E_ZONE, capacity: 4 })
        });
        await app.request('/api/admin/menu/categories', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: E2E_CAT, name: 'Cat E2E' })
        });
        await app.request('/api/admin/menu/dishes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishCode: E2E_DISH, categoryCode: E2E_CAT, name: 'Taco E2E', price: 100, isActive: true })
        });

        // Crear insumo y receta para que el platillo vaya a PENDING_KITCHEN
        await app.request('/api/kitchen/ingredients', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'E2E-ING-01', name: 'Insumo E2E', unit: 'PZ' })
        });
        await app.request('/api/kitchen/recipes/items', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishCode: E2E_DISH, ingredientCode: 'E2E-ING-01', quantity: 1 })
        });

        // PIN del cajero/mesero via API (bcrypt)
        await app.request('/api/admin/employees/ADMIN001/reset-pin', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: ADMIN_PIN })
        });

        // Área con permiso de caja
        const areasRes = await app.request('/api/admin/employees/areas', { method: 'GET' });
        const areas = (await areasRes.json()).data;
        if (areas?.length > 0) {
            await app.request(`/api/admin/employees/areas/${areas[0].code}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ areaName: areas[0].name, canAccessCashier: true, isActive: true })
            });
        }
    });

    // ── PASO 1: Abrir mesa ────────────────────────────────────
    it('E2E-01 Mesero abre la mesa E2E-T01', async () => {
        await executeQuery(null, `UPDATE order_headers SET status = 'CLOSED' WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = '${E2E_TABLE}') AND status IN ('OPEN','AWAITING_PAYMENT')`);

        const res = await app.request(`/api/waiters/tables/${E2E_TABLE}/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', diners: 2 })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        orderCode = data.data.body.orderCode;
        expect(orderCode).toBeDefined();
    });

    // ── PASO 2: Enviar comanda ────────────────────────────────
    it('E2E-02 Mesero envía la comanda con un taco', async () => {
        const res = await app.request(`/api/waiters/tables/${E2E_TABLE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'ADMIN001',
                items: [{ dishCode: E2E_DISH, quantity: 1 }]
            })
        });

        expect(res.status).toBe(200);
        const items = await executeQuery(null, `
            SELECT oi.id, oi.status FROM order_items oi
            JOIN order_headers oh ON oh.id = oi.order_id
            WHERE oh.code = $1
        `, [orderCode]);
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].status).toBe('PENDING_KITCHEN');
        itemId = items[0].id;
    });

    // ── PASO 3: KDS avanza el item ────────────────────────────
    it('E2E-03 Cocina avanza el item a PREPARING', async () => {
        const res = await app.request(`/api/kitchen/items/${itemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PREPARING' })
        });
        expect(res.status).toBe(200);
    });

    it('E2E-04 Cocina avanza el item a READY', async () => {
        const res = await app.request(`/api/kitchen/items/${itemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'READY' })
        });
        expect(res.status).toBe(200);
    });

    // ── PASO 4: Mesero recolecta y entrega ────────────────────
    it('E2E-05 Mesero recolecta el item listo en cocina', async () => {
        const res = await app.request(`/api/waiters/tables/${E2E_TABLE}/items/${itemId}/collect`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });
        expect(res.status).toBe(200);
    });

    it('E2E-06 Mesero entrega el item en la mesa', async () => {
        const res = await app.request(`/api/waiters/tables/${E2E_TABLE}/items/${itemId}/deliver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(200);
    });

    // ── PASO 5: Cerrar mesa ───────────────────────────────────
    it('E2E-07 Mesero cierra la mesa enviándola a AWAITING_PAYMENT', async () => {
        const res = await app.request(`/api/waiters/tables/${E2E_TABLE}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT status FROM order_headers WHERE code = $1`, [orderCode]);
        expect(checkRes[0].status).toBe('AWAITING_PAYMENT');
    });

    // ── PASO 6: Cajero procesa el pago ────────────────────────
    it('E2E-08 El tablero de caja muestra la mesa en AWAITING_PAYMENT', async () => {
        const res = await app.request('/api/admin/cashier/board', { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        const tables = data.data?.body?.tables || data.data?.tables || [];
        const mesa = tables.find(t => t.tableCode === E2E_TABLE);
        expect(mesa).toBeDefined();
    });

    it('E2E-09 Cajero procesa el pago y obtiene folio', async () => {
        const res = await app.request(`/api/admin/cashier/tables/${E2E_TABLE}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashierCode: 'ADMIN001',
                payments: [{ method: 'CASH', amount: 100 }],
                tip: 10
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        const body = data.data?.body || data.data || {};
        expect(body.folio).toMatch(/^TKT-/);
        ticketFolio = body.folio;

        const checkRes = await executeQuery(null, `SELECT status FROM order_headers WHERE code = $1`, [orderCode]);
        expect(checkRes[0].status).toBe('CLOSED');
    });

    // ── PASO 7: Verificar ticket ──────────────────────────────
    it('E2E-10 El ticket puede consultarse por su folio', async () => {
        const res = await app.request(`/api/admin/cashier/tickets/${ticketFolio}`, { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        const ticket = data.data?.body?.ticket || data.data?.ticket || {};
        expect(ticket.folio).toBe(ticketFolio);
        expect(Number(ticket.total)).toBeGreaterThan(0);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    // NO se nullifica pin_code de ADMIN001 — otros tests lo necesitan.
    afterAll(async () => {
        if (orderCode) {
            await executeQuery(null, `DELETE FROM payments      WHERE order_id IN (SELECT id FROM order_headers WHERE code = $1)`, [orderCode]);
            await executeQuery(null, `DELETE FROM tickets       WHERE order_id IN (SELECT id FROM order_headers WHERE code = $1)`, [orderCode]);
            await executeQuery(null, `DELETE FROM order_items   WHERE order_id IN (SELECT id FROM order_headers WHERE code = $1)`, [orderCode]);
            await executeQuery(null, `DELETE FROM order_headers WHERE code = $1`, [orderCode]);
        }
        await executeQuery(null, `DELETE FROM dish_recipes WHERE dish_id IN (SELECT id FROM menu_dishes WHERE code = '${E2E_DISH}')`);
        await executeQuery(null, `DELETE FROM inventory_items WHERE code = 'E2E-ING-01'`);
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code = '${E2E_DISH}'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = '${E2E_CAT}'`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = '${E2E_TABLE}'`);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = '${E2E_ZONE}'`);
    });
});