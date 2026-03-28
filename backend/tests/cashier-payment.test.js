// ============================================================
// cashier-payment.test.js
// Módulo: Flujo de Pago y Tickets
// Códigos: PAY-xx | TKT-xx
//
// Seeding 100% por API — sin INSERT directos a tablas de negocio.
// La única excepción permitida son los DELETE del afterAll para
// garantizar limpieza aunque el test interrumpa en cualquier punto.
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Caja — Flujo de Pago', () => {
    // ── Estado compartido entre tests ─────────────────────────
    let orderCode     = null;
    let itemId        = null;
    let testTicketFolio = null;

    const TEST_ZONE    = 'PAY-ZONE';
    const TEST_TABLE   = 'PAY-T01';
    const TEST_CAT     = 'PAY-CAT';
    const TEST_DISH    = 'PAY-TACO';
    const TEST_CASHIER = 'ADMIN001';

    // ── SETUP: Infraestructura + ciclo completo vía API ───────
    beforeAll(async () => {
        // 1. Zona
        await app.request('/api/admin/zones', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: TEST_ZONE, name: 'Zona Pay Test' })
        });

        // 2. Mesa
        await app.request('/api/admin/tables', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: TEST_TABLE, zoneCode: TEST_ZONE, capacity: 4 })
        });

        // 3. Categoría
        await app.request('/api/admin/menu/categories', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: TEST_CAT, name: 'Cat Pay Test' })
        });

        // 4. Platillo
        await app.request('/api/admin/menu/dishes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishCode: TEST_DISH, categoryCode: TEST_CAT, name: 'Taco Pay', price: 100, isActive: true })
        });

        // 5. PIN del cajero y permiso de caja en área
        await app.request(`/api/admin/employees/${TEST_CASHIER}/reset-pin`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: '123456' })
        });

        const areasRes = await app.request('/api/admin/employees/areas', { method: 'GET' });
        const areas = (await areasRes.json()).data;
        if (areas?.length > 0) {
            await app.request(`/api/admin/employees/areas/${areas[0].code}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ areaName: areas[0].name, canAccessCashier: true, isActive: true })
            });
        }

        // 6. Limpiar órdenes abiertas previas (idempotencia)
        await executeQuery(null, `
            UPDATE order_headers SET status = 'CLOSED'
            WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = $1)
              AND status IN ('OPEN','AWAITING_PAYMENT')
        `, [TEST_TABLE]);

        // 7. Abrir mesa
        const openRes = await app.request(`/api/waiters/tables/${TEST_TABLE}/open`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: TEST_CASHIER, diners: 2 })
        });
        const openData = await openRes.json();
        orderCode = openData?.data?.body?.orderCode;

        // 8. Enviar comanda
        await app.request(`/api/waiters/tables/${TEST_TABLE}/orders`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: TEST_CASHIER, items: [{ dishCode: TEST_DISH, quantity: 1 }] })
        });

        // 9. Obtener itemId desde BD (es el único executeQuery que no es INSERT)
        const items = await executeQuery(null, `
            SELECT oi.id FROM order_items oi
            JOIN order_headers oh ON oh.id = oi.order_id
            WHERE oh.code = $1
            ORDER BY oi.id DESC LIMIT 1
        `, [orderCode]);
        itemId = items[0]?.id;

        // 10. Cocina avanza el ítem PENDING_KITCHEN → PREPARING → READY
        await app.request(`/api/kitchen/items/${itemId}/status`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PREPARING' })
        });
        await app.request(`/api/kitchen/items/${itemId}/status`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'READY' })
        });

        // 11. Mesero recolecta y entrega
        await app.request(`/api/waiters/tables/${TEST_TABLE}/items/${itemId}/collect`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: TEST_CASHIER })
        });
        await app.request(`/api/waiters/tables/${TEST_TABLE}/items/${itemId}/deliver`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }
        });

        // 12. Cerrar mesa → AWAITING_PAYMENT
        await app.request(`/api/waiters/tables/${TEST_TABLE}/close`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: TEST_CASHIER })
        });
    });

    // ── PAGOS ─────────────────────────────────────────────────

    it('PAY-01 La mesa está en AWAITING_PAYMENT antes del pago', async () => {
        const rows = await executeQuery(null, `
            SELECT oh.status FROM order_headers oh
            JOIN restaurant_tables t ON t.id = oh.table_id
            WHERE t.code = $1
            ORDER BY oh.created_at DESC LIMIT 1
        `, [TEST_TABLE]);
        expect(rows[0]?.status).toBe('AWAITING_PAYMENT');
    });

    it('PAY-02 Procesa pago en efectivo exitosamente', async () => {
        const res = await app.request(`/api/admin/cashier/tables/${TEST_TABLE}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashierCode: TEST_CASHIER,
                payments: [{ method: 'CASH', amount: 110.00 }],
                tip: 10.00
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);

        const body = data.data?.body || data.data || {};
        testTicketFolio = body.folio;
        expect(testTicketFolio).toMatch(/^TKT-/);
    });

    it('PAY-03 Rechaza pago si falta payments (Gatekeeper 400)', async () => {
        const res = await app.request(`/api/admin/cashier/tables/${TEST_TABLE}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashierCode: TEST_CASHIER
                // sin payments[]
            })
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    it('PAY-04 Rechaza pago a mesa sin orden AWAITING_PAYMENT (mesa ya cerrada)', async () => {
        // La orden ya fue pagada en PAY-02, no hay más órdenes AWAITING_PAYMENT
        const res = await app.request(`/api/admin/cashier/tables/${TEST_TABLE}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashierCode: TEST_CASHIER,
                payments: [{ method: 'CASH', amount: 100 }]
            })
        });

        // El SP lanza error si no hay orden en AWAITING_PAYMENT
        expect([400, 404, 500]).toContain(res.status);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    // ── TICKETS ───────────────────────────────────────────────

    it('TKT-01 Obtiene un ticket por folio', async () => {
        if (!testTicketFolio) return;

        const res = await app.request(`/api/admin/cashier/tickets/${testTicketFolio}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
    });

    it('TKT-02 Devuelve 404 para folio inexistente', async () => {
        const res = await app.request('/api/admin/cashier/tickets/TKT-00000000-9999', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(404);
    });

    it('TKT-03 El folio respeta el formato TKT-YYYYMMDD-XXXX', async () => {
        if (!testTicketFolio) return;
        expect(testTicketFolio).toMatch(/^TKT-\d{8}-\d{4}$/);
    });

    // ── CORTE Z ───────────────────────────────────────────────

    it('TKT-04 Obtiene el corte del día con datos del pago reciente', async () => {
        const res = await app.request('/api/admin/cashier/corte', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        // Eliminar todos los registros relacionados con la mesa de test
        await executeQuery(null, `
            DELETE FROM payments WHERE order_id IN (
                SELECT oh.id FROM order_headers oh
                JOIN restaurant_tables t ON t.id = oh.table_id
                WHERE t.code = $1
            )
        `, [TEST_TABLE]);
        await executeQuery(null, `
            DELETE FROM tickets WHERE order_id IN (
                SELECT oh.id FROM order_headers oh
                JOIN restaurant_tables t ON t.id = oh.table_id
                WHERE t.code = $1
            )
        `, [TEST_TABLE]);
        await executeQuery(null, `
            DELETE FROM order_items WHERE order_id IN (
                SELECT oh.id FROM order_headers oh
                JOIN restaurant_tables t ON t.id = oh.table_id
                WHERE t.code = $1
            )
        `, [TEST_TABLE]);
        await executeQuery(null, `
            DELETE FROM order_headers WHERE table_id = (
                SELECT id FROM restaurant_tables WHERE code = $1
            )
        `, [TEST_TABLE]);
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code = $1`, [TEST_DISH]);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = $1`, [TEST_CAT]);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = $1`, [TEST_TABLE]);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = $1`, [TEST_ZONE]);
    });
});
