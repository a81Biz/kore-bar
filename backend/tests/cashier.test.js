// ============================================================
// cashier.test.js
// Módulo: Caja — Login, Tablero, Pagos y Tickets
// Códigos: CAJA-xx
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Caja', () => {
    const testOrderCode = `TEST-CASHIER-${Date.now()}`;
    let testTableCode = null;
    let createdFolio = null;

    // Setup: crear infraestructura propia — no depender de datos existentes
    beforeAll(async () => {
        await executeQuery(null, `INSERT INTO restaurant_zones  (code, name)              VALUES ('CAJA-ZONE', 'Zona Caja Test') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity) VALUES ('CAJA-T01', (SELECT id FROM restaurant_zones WHERE code='CAJA-ZONE'), 4) ON CONFLICT (code) DO NOTHING`);
        testTableCode = 'CAJA-T01';

        // Área con permiso de caja
        await executeQuery(null, `UPDATE areas SET can_access_cashier = true WHERE code = (SELECT code FROM areas ORDER BY code LIMIT 1)`);
    });

    // ── EMPLEADOS ELEGIBLES ───────────────────────────────────

    it('CAJA-01 Devuelve empleados con acceso a caja', async () => {
        const res = await app.request('/api/admin/cashier/employees', { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data.body.employees)).toBe(true);
    });

    // ── LOGIN ─────────────────────────────────────────────────

    it('CAJA-02 Autentica cajero con PIN correcto', async () => {
        const areasRes = await app.request('/api/admin/employees/areas', { method: 'GET' });
        const areasData = await areasRes.json();
        const cashierArea = areasData.data.find(a => a.can_access_cashier === true);

        await app.request('/api/admin/employees/ADMIN001', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaId: cashierArea?.code, jobTitleId: '01', pinCode: '123456' })
        });

        const res = await app.request('/api/admin/cashier/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', pin: '123456' })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.employeeNumber).toBe('ADMIN001');
    });

    it('CAJA-03 Rechaza PIN incorrecto con 401', async () => {
        const res = await app.request('/api/admin/cashier/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', pin: '000000' })
        });
        expect(res.status).toBe(401);
    });

    it('CAJA-04 Rechaza login sin `pin` (Gatekeeper 400)', async () => {
        const res = await app.request('/api/admin/cashier/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001' })
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    it('CAJA-05 Rechaza login sin `employeeNumber` (Gatekeeper 400)', async () => {
        const res = await app.request('/api/admin/cashier/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '123456' })
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    // ── TABLERO ───────────────────────────────────────────────

    it('CAJA-06 Devuelve el tablero de mesas en AWAITING_PAYMENT', async () => {
        // Cerrar órdenes previas y crear una de prueba
        await executeQuery(null, `
            UPDATE order_headers SET status = 'CLOSED'
            WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = $1)
              AND status IN ('OPEN', 'AWAITING_PAYMENT')
        `, [testTableCode]);
        await executeQuery(null, `
            INSERT INTO order_headers (code, table_id, waiter_id, diners, status, total)
            SELECT $1, rt.id, e.id, 2, 'AWAITING_PAYMENT', 500.00
            FROM restaurant_tables rt CROSS JOIN employees e
            WHERE rt.code = $2 AND e.employee_number = 'ADMIN001'
        `, [testOrderCode, testTableCode]);

        const res = await app.request('/api/admin/cashier/board', { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data.body.tables)).toBe(true);

        // FIX: camelCase en la respuesta mapeada por el helper
        const mesa = data.data.body.tables.find(t => t.tableCode === testTableCode);
        expect(mesa).toBeDefined();
        expect(Number(mesa.total)).toBe(500.00);
    });

    // ── PROCESAMIENTO DE PAGO ─────────────────────────────────

    it('CAJA-07 Procesa el pago de una mesa y devuelve folio TKT-', async () => {
        const res = await app.request(`/api/admin/cashier/tables/${testTableCode}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashierCode: 'ADMIN001', payments: [{ method: 'CASH', amount: 500 }], tip: 50 })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.folio).toMatch(/^TKT-/);

        createdFolio = data.data.body.folio;

        const checkRes = await executeQuery(null, `SELECT status FROM order_headers WHERE code = $1`, [testOrderCode]);
        expect(checkRes[0].status).toBe('CLOSED');
    });

    it('CAJA-08 Rechaza pago si la mesa no existe (400)', async () => {
        const res = await app.request('/api/admin/cashier/tables/MESA-FALSA/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashierCode: 'ADMIN001', payments: [{ method: 'CASH', amount: 100 }] })
        });
        // El SP lanza P0001 → el helper debe mapearlo a 400, no 500
        expect(res.status).toBe(400);
    });

    it('CAJA-09 Rechaza pago sin `payments` (Gatekeeper 400)', async () => {
        const res = await app.request('/api/admin/cashier/tables/CUALQUIER/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashierCode: 'ADMIN001' })
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    // ── TICKET ────────────────────────────────────────────────

    it('CAJA-10 Devuelve el ticket por folio existente', async () => {
        const res = await app.request(`/api/admin/cashier/tickets/${createdFolio}`, { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.ticket.folio).toBe(createdFolio);
        expect(Number(data.data.body.ticket.total)).toBe(500.00);
        expect(data.data.body.ticket.isInvoiced).toBe(false);
    });

    it('CAJA-11 Devuelve 404 para un folio inexistente', async () => {
        const res = await app.request('/api/admin/cashier/tickets/TKT-NO-EXISTE-000', { method: 'GET' });
        expect(res.status).toBe(404);
    });

    // ── CORTE Z ───────────────────────────────────────────────

    it('CAJA-12 Devuelve el corte Z del día con resumen por método de pago', async () => {
        const res = await app.request('/api/admin/cashier/corte', { method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.body.corte.date).toBeDefined();
        expect(Array.isArray(data.data.body.corte.byMethod)).toBe(true);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM payments      WHERE order_id = (SELECT id FROM order_headers WHERE code = $1)`, [testOrderCode]);
        await executeQuery(null, `DELETE FROM tickets       WHERE order_id = (SELECT id FROM order_headers WHERE code = $1)`, [testOrderCode]);
        await executeQuery(null, `DELETE FROM order_items   WHERE order_id = (SELECT id FROM order_headers WHERE code = $1)`, [testOrderCode]);
        await executeQuery(null, `DELETE FROM order_headers WHERE code = $1`, [testOrderCode]);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'CAJA-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = 'CAJA-ZONE'`);
        await executeQuery(null, `UPDATE employees SET pin_code = NULL, position_id = NULL WHERE employee_number = 'ADMIN001'`);
    });
});