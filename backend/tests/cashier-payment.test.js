// ============================================================
// cashier-payment.test.js
// Módulo: Flujo de Pago y Tickets
// Códigos: PAY-xx | TKT-xx
// ============================================================
import { describe, it, expect, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Caja — Flujo de Pago', () => {
    let testOrderCode  = null;
    let testTicketFolio = null;
    let testTableId    = null;

    // ── SETUP: Crear mesa y orden de prueba ───────────────────

    it('PAY-01 Crea una orden de prueba para la mesa T-TEST-PAY', async () => {
        // Asegurar que existe una mesa de test
        await executeQuery(null, `
            INSERT INTO restaurant_zones (code, name, is_active)
            VALUES ('Z-TEST-PAY', 'Zona Test Pay', true)
            ON CONFLICT (code) DO NOTHING
        `);

        await executeQuery(null, `
            INSERT INTO restaurant_tables (code, zone_id, capacity, is_active)
            VALUES ('T-TEST-PAY', (SELECT id FROM restaurant_zones WHERE code = 'Z-TEST-PAY'), 4, true)
            ON CONFLICT (code) DO NOTHING
        `);

        const tableRes = await executeQuery(null,
            `SELECT id FROM restaurant_tables WHERE code = 'T-TEST-PAY'`
        );
        testTableId = tableRes[0].id;

        // Crear orden directamente en BD para el test
        await executeQuery(null, `
            INSERT INTO order_headers (code, table_id, status, total)
            VALUES ('ORD-TEST-PAY', $1, 'AWAITING_PAYMENT', 500.00)
            ON CONFLICT (code) DO UPDATE SET status = 'AWAITING_PAYMENT', total = 500.00
        `, [testTableId]);

        testOrderCode = 'ORD-TEST-PAY';

        const orderCheck = await executeQuery(null,
            `SELECT status FROM order_headers WHERE code = 'ORD-TEST-PAY'`
        );
        expect(orderCheck[0].status).toBe('AWAITING_PAYMENT');
    });

    // ── PAGOS ─────────────────────────────────────────────────

    it('PAY-02 Procesa un pago en efectivo exitosamente', async () => {
        const res = await app.request('/api/cashier/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderCode: testOrderCode,
                payments:  [{ method: 'CASH', amount: 500.00 }],
                tip: 50.00
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.folio).toMatch(/^TKT-/);
        testTicketFolio = data.data.folio;
    });

    it('PAY-03 Rechaza pago si falta el array payments (Gatekeeper 400)', async () => {
        const res = await app.request('/api/cashier/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderCode: 'ORD-FAKE'
                // sin payments[]
            })
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    it('PAY-04 Rechaza pago a orden inexistente (404)', async () => {
        const res = await app.request('/api/cashier/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderCode: 'ORD-NO-EXISTE',
                payments:  [{ method: 'CASH', amount: 100 }]
            })
        });

        // Puede ser 404 o 400 dependiendo del SP
        expect([400, 404]).toContain(res.status);
    });

    // ── TICKETS ───────────────────────────────────────────────

    it('TKT-01 Obtiene un ticket por folio exitosamente', async () => {
        if (!testTicketFolio) return; // Skip si PAY-02 falló

        const res = await app.request(`/api/cashier/tickets/${testTicketFolio}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.folio).toBe(testTicketFolio);
    });

    it('TKT-02 Devuelve 404 para folio inexistente', async () => {
        const res = await app.request('/api/cashier/tickets/TKT-00000000-9999', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(404);
    });

    it('TKT-03 Obtiene datos de impresión de ticket', async () => {
        if (!testTicketFolio) return;

        const res = await app.request(`/api/cashier/tickets/${testTicketFolio}/print`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('header');
        expect(data.data).toHaveProperty('items');
        expect(data.data).toHaveProperty('totals');
        expect(data.data).toHaveProperty('footer');
        expect(data.data.header.folio).toBe(testTicketFolio);
    });

    // ── CORTE Z ───────────────────────────────────────────────

    it('TKT-04 Obtiene el corte del día con datos agregados', async () => {
        const res = await app.request('/api/cashier/corte', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);

        // Debe tener las propiedades del corte
        if (data.data && data.data.length > 0) {
            const corte = data.data[0];
            expect(corte).toHaveProperty('total_tickets');
            expect(corte).toHaveProperty('total_cash');
        }
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        // Limpiar ticket de prueba
        if (testTicketFolio) {
            await executeQuery(null, `DELETE FROM tickets WHERE folio = $1`, [testTicketFolio]);
        }
        // Limpiar orden de prueba
        await executeQuery(null, `DELETE FROM order_items WHERE order_id IN (SELECT id FROM order_headers WHERE code = 'ORD-TEST-PAY')`);
        await executeQuery(null, `DELETE FROM order_headers WHERE code = 'ORD-TEST-PAY'`);
        // Limpiar mesa y zona de prueba
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'T-TEST-PAY'`);
        await executeQuery(null, `DELETE FROM restaurant_zones WHERE code = 'Z-TEST-PAY'`);
    });
});
