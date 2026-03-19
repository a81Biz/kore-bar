// ============================================================
// e2e-operacion.test.js
// Prueba E2E: Flujo operativo completo de un turno
// Códigos: E2E-xx
//
// Flujo:
//   1. Mesero abre mesa
//   2. Mesero envía comanda
//   3. Cocina avanza item a PREPARING → READY
//   4. Mesero recolecta y entrega
//   5. Mesero cierra mesa (→ AWAITING_PAYMENT)
//   6. Cajero procesa el pago (→ CLOSED + ticket)
//   7. Se verifica el folio en la consulta de ticket
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('E2E — Operación Completa de un Turno', () => {
    let orderCode = null;
    let itemId = null;
    let ticketFolio = null;

    // Setup: toda la infraestructura necesaria para el flujo
    beforeAll(async () => {
        await executeQuery(null, `INSERT INTO restaurant_zones  (code, name)                    VALUES ('E2E-ZONE', 'Zona E2E') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity)        VALUES ('E2E-T01', (SELECT id FROM restaurant_zones WHERE code='E2E-ZONE'), 4) ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO menu_categories   (code, name)                    VALUES ('E2E-CAT', 'Cat E2E') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `
            INSERT INTO menu_dishes (code, category_id, name, price, has_recipe, is_active)
            VALUES ('E2E-TACO', (SELECT id FROM menu_categories WHERE code='E2E-CAT'), 'Taco E2E', 100, true, true)
            ON CONFLICT (code) DO NOTHING
        `);
        // PIN del cajero/mesero (usamos ADMIN001 para ambos roles en el E2E)
        await executeQuery(null, `UPDATE employees SET pin_code = '123456' WHERE employee_number = 'ADMIN001'`);
        // Área con permiso de caja
        await executeQuery(null, `UPDATE areas SET can_access_cashier = true WHERE code = (SELECT code FROM areas ORDER BY code LIMIT 1)`);
    });

    // ── PASO 1: Abrir mesa ────────────────────────────────────
    it('E2E-01 Mesero abre la mesa E2E-T01', async () => {
        await executeQuery(null, `UPDATE order_headers SET status = 'CLOSED' WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'E2E-T01') AND status IN ('OPEN','AWAITING_PAYMENT')`);

        const res = await app.request('/api/waiters/tables/E2E-T01/open', {
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
        const res = await app.request('/api/waiters/tables/E2E-T01/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'ADMIN001',
                items: [{ dishCode: 'E2E-TACO', quantity: 1 }]
            })
        });

        expect(res.status).toBe(200);
        // Verificar que el item llegó al KDS en PENDING_KITCHEN
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
        const res = await app.request(`/api/waiters/tables/E2E-T01/items/${itemId}/collect`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });
        expect(res.status).toBe(200);
    });

    it('E2E-06 Mesero entrega el item en la mesa', async () => {
        const res = await app.request(`/api/waiters/tables/E2E-T01/items/${itemId}/deliver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(200);
    });

    // ── PASO 5: Cerrar mesa ───────────────────────────────────
    it('E2E-07 Mesero cierra la mesa enviándola a AWAITING_PAYMENT', async () => {
        const res = await app.request('/api/waiters/tables/E2E-T01/close', {
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
        const mesa = data.data.body.tables.find(t => t.tableCode === 'E2E-T01');
        expect(mesa).toBeDefined();
    });

    it('E2E-09 Cajero procesa el pago y obtiene folio', async () => {
        const res = await app.request('/api/admin/cashier/tables/E2E-T01/pay', {
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
        expect(data.data.body.folio).toMatch(/^TKT-/);
        ticketFolio = data.data.body.folio;

        const checkRes = await executeQuery(null, `SELECT status FROM order_headers WHERE code = $1`, [orderCode]);
        expect(checkRes[0].status).toBe('CLOSED');
    });

    // ── PASO 7: Verificar ticket ──────────────────────────────
    it('E2E-10 El ticket puede consultarse por su folio', async () => {
        const res = await app.request(`/api/admin/cashier/tickets/${ticketFolio}`, { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.data.body.ticket.folio).toBe(ticketFolio);
        expect(Number(data.data.body.ticket.total)).toBe(100);
        expect(data.data.body.ticket.isInvoiced).toBe(false);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM payments      WHERE order_id IN (SELECT id FROM order_headers WHERE code = $1)`, [orderCode]);
        await executeQuery(null, `DELETE FROM tickets       WHERE order_id IN (SELECT id FROM order_headers WHERE code = $1)`, [orderCode]);
        await executeQuery(null, `DELETE FROM order_items   WHERE order_id IN (SELECT id FROM order_headers WHERE code = $1)`, [orderCode]);
        await executeQuery(null, `DELETE FROM order_headers WHERE code = $1`, [orderCode]);
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code = 'E2E-TACO'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = 'E2E-CAT'`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'E2E-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = 'E2E-ZONE'`);
        await executeQuery(null, `UPDATE employees SET pin_code = NULL WHERE employee_number = 'ADMIN001'`);
    });
});
