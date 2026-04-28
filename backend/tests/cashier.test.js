// ============================================================
// cashier.test.js
// Módulo: Caja — Login, Tablero, Pagos y Tickets
// Códigos: CAJA-xx
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Caja', () => {
    const testZoneCode = 'CAJA-ZONE';
    const testTableCode = 'CAJA-T01';
    const testCategoryCode = 'CAJA-CAT';
    const testDishCode = 'CAJA-DISH';
    const testEmployeeNumber = 'CASHIER-TEST';
    const testAreaCode = 'AREA-CAJA';
    const testJobCode = 'JOB-CAJA';
    const testPin = '123456';
    let createdFolio = null;

    // ── Función de limpieza (usada en beforeAll y afterAll) ───
    const cleanup = async () => {
        await executeQuery(null, `DELETE FROM tickets WHERE order_id IN (SELECT id FROM order_headers WHERE table_id IN (SELECT id FROM restaurant_tables WHERE code = $1))`, [testTableCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM payments WHERE order_id IN (SELECT id FROM order_headers WHERE table_id IN (SELECT id FROM restaurant_tables WHERE code = $1))`, [testTableCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM order_items WHERE order_id IN (SELECT id FROM order_headers WHERE table_id IN (SELECT id FROM restaurant_tables WHERE code = $1))`, [testTableCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM order_headers WHERE table_id IN (SELECT id FROM restaurant_tables WHERE code = $1)`, [testTableCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = $1`, [testTableCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM restaurant_zones WHERE code = $1`, [testZoneCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM menu_dishes WHERE code = $1`, [testDishCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = $1`, [testCategoryCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM system_users WHERE employee_number = $1`, [testEmployeeNumber]).catch(() => { });
        await executeQuery(null, `DELETE FROM employees WHERE employee_number = $1`, [testEmployeeNumber]).catch(() => { });
        await executeQuery(null, `DELETE FROM positions WHERE code = $1`, [`${testAreaCode}-${testJobCode}`]).catch(() => { });
        await executeQuery(null, `DELETE FROM job_titles WHERE code = $1`, [testJobCode]).catch(() => { });
        await executeQuery(null, `DELETE FROM areas WHERE code = $1`, [testAreaCode]).catch(() => { });
    };

    beforeAll(async () => {
        // 0. Limpiar datos sucios de corridas anteriores con teardowns rotos
        await cleanup();

        // 1. sync-catalogs crea área + puesto + posición (pivot) en una sola llamada
        await app.request('/api/admin/employees/sync-catalogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catalogo_puestos: [{
                    codigo_area: testAreaCode,
                    nombre_area: 'Area Caja Test',
                    codigo_puesto: testJobCode,
                    nombre_puesto: 'Cajero Test'
                }]
            })
        });

        // 2. Habilitar acceso a caja en el área
        await app.request(`/api/admin/employees/areas/${testAreaCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaName: 'Area Caja Test', canAccessCashier: true })
        });

        // 3. Crear empleado
        await app.request('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: testEmployeeNumber,
                firstName: 'Cajero',
                lastName: 'Prueba',
                areaId: testAreaCode,
                jobTitleId: testJobCode,
                isActive: true
            })
        });

        // 4. Establecer PIN
        await app.request(`/api/admin/employees/${testEmployeeNumber}/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: testPin })
        });

        // 5. Crear Zona y Mesa
        await app.request('/api/admin/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: testZoneCode, name: 'Zona Caja' })
        });
        await app.request('/api/admin/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: testTableCode, zoneCode: testZoneCode, capacity: 4 })
        });

        // 6. Crear Categoría y Platillo
        await app.request('/api/admin/menu/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: testCategoryCode, name: 'Cat Caja' })
        });
        const dishRes = await app.request('/api/admin/menu/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishCode: testDishCode, categoryCode: testCategoryCode,
                name: 'Platillo Caja', price: 500, isActive: true
            })
        });
        if (!dishRes.ok) throw new Error(`Setup falló al crear el platillo: ${dishRes.status}`);

        // 7. Ciclo de orden: abrir → comanda → cerrar (→ AWAITING_PAYMENT)
        await app.request(`/api/waiters/tables/${testTableCode}/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: testEmployeeNumber, diners: 2 })
        });

        const orderRes = await app.request(`/api/waiters/tables/${testTableCode}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: testEmployeeNumber,
                items: [{ dishCode: testDishCode, quantity: 2 }]
            })
        });
        if (!orderRes.ok) throw new Error(`Setup falló al enviar la comanda: ${orderRes.status}`);

        await app.request(`/api/waiters/tables/${testTableCode}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: testEmployeeNumber })
        });
    });

    afterAll(async () => {
        await cleanup();
    });

    // ── TESTS ─────────────────────────────────────────────────

    it('CAJA-01 Devuelve empleados con acceso a caja', async () => {
        const res = await app.request('/api/admin/cashier/employees', { method: 'GET' });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        const employees = json.data?.employees || json.data?.body?.employees || json.data;
        expect(Array.isArray(employees)).toBe(true);
        expect(employees.some(e => e.employeeNumber === testEmployeeNumber)).toBe(true);
    });

    it('CAJA-02 Autentica cajero con PIN correcto', async () => {
        const res = await app.request('/api/admin/auth/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: testEmployeeNumber,
                pinCode: testPin,
                context: 'cashier'
            })
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        const body = json.data?.body || json.data || {};
        expect(body.employeeNumber).toBe(testEmployeeNumber);
    });

    it('CAJA-03 Rechaza PIN incorrecto con 401', async () => {
        const res = await app.request('/api/admin/auth/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: testEmployeeNumber,
                pinCode: '0000',
                context: 'cashier'
            })
        });
        expect(res.status).toBe(401);
    });

    it('CAJA-04 La mesa está en AWAITING_PAYMENT antes del pago', async () => {
        const rows = await executeQuery(null, `
            SELECT oh.status FROM order_headers oh
            JOIN restaurant_tables t ON t.id = oh.table_id
            WHERE t.code = $1
            ORDER BY oh.created_at DESC LIMIT 1
        `, [testTableCode]);
        expect(rows[0]?.status).toBe('AWAITING_PAYMENT');
    });

    it('CAJA-05 La orden tiene 2 ítems (cantidad × platillo)', async () => {
        const rows = await executeQuery(null, `
            SELECT SUM(oi.quantity)::int AS total
            FROM order_items oi
            JOIN order_headers oh ON oh.id = oi.order_id
            JOIN restaurant_tables t ON t.id = oh.table_id
            WHERE t.code = $1
        `, [testTableCode]);
        expect(rows[0]?.total).toBe(2);
    });

    it('CAJA-06 Devuelve el tablero de mesas en AWAITING_PAYMENT', async () => {
        const res = await app.request('/api/admin/cashier/board', { method: 'GET' });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        const tables = json.data?.tables || json.data?.body?.tables || json.data;
        expect(Array.isArray(tables)).toBe(true);
        expect(tables.some(t => t.tableCode === testTableCode)).toBe(true);
    });

    it('CAJA-07 Procesa el pago de una mesa y devuelve folio TKT-', async () => {
        const res = await app.request(`/api/admin/cashier/tables/${testTableCode}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashierCode: testEmployeeNumber,
                payments: [{ method: 'CASH', amount: 1000 }],
                tip: 0
            })
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        const body = json.data?.body || json.data || {};
        expect(body.folio).toMatch(/^TKT-/);
        createdFolio = body.folio;
    });

    it('CAJA-08 Rechaza pago en mesa que no está en AWAITING_PAYMENT', async () => {
        const res = await app.request(`/api/admin/cashier/tables/${testTableCode}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashierCode: testEmployeeNumber,
                payments: [{ method: 'CASH', amount: 1000 }],
                tip: 0
            })
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
        const json = await res.json();
        expect(json.success).toBe(false);
    });

    it('CAJA-10 Devuelve el ticket por folio existente', async () => {
        expect(createdFolio).not.toBeNull();
        const res = await app.request(`/api/admin/cashier/tickets/${createdFolio}`, { method: 'GET' });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
    });

    it('CAJA-12 Devuelve el corte Z del día', async () => {
        const res = await app.request('/api/admin/cashier/corte', { method: 'GET' });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
    });
});