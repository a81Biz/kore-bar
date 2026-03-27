// ============================================================
// admin-reports.test.js
// Módulo: Reportes de Ventas y Dashboard KPIs
// Códigos: RPT-xx | KPI-xx
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Reportes de Ventas y Dashboard', () => {
    let orderCode = null;
    let itemId = null;
    let ticketFolio = null;

    beforeAll(async () => {
        console.log("Setup 1: Zonas");
        await app.request('/api/admin/zones', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: 'RPT-ZONE', name: 'Zona RPT' })
        });
        
        console.log("Setup 2: Mesas");
        await app.request('/api/admin/tables', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: 'RPT-T01', zoneCode: 'RPT-ZONE', capacity: 4 })
        });

        console.log("Setup 3: Categorias");
        await app.request('/api/admin/menu/categories', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: 'RPT-CAT', name: 'Cat RPT' })
        });

        console.log("Setup 4: Platillos");
        await app.request('/api/admin/menu/dishes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishCode: 'RPT-TACO', categoryCode: 'RPT-CAT', name: 'Taco RPT', price: 150, isActive: true })
        });

        console.log("Setup 5: PIN Admin");
        await app.request('/api/admin/employees/ADMIN001/reset-pin', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: '123456' })
        });

        console.log("Setup 6: Areas (Caja)");
        const areasRes = await app.request('/api/admin/employees/areas', { method: 'GET' });
        const areas = (await areasRes.json()).data;
        if (areas && areas.length > 0) {
            await app.request(`/api/admin/employees/areas/${areas[0].code}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ areaName: areas[0].name, canAccessCashier: true, isActive: true })
            });
        }

        // Limpiar cualquier orden abierta atascada de corridas anteriores
        console.log("Setup: Limpieza de ordenes previas");
        await executeQuery(null, `UPDATE order_headers SET status = 'CLOSED' WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'RPT-T01') AND status IN ('OPEN','AWAITING_PAYMENT')`);


        console.log("Setup 7: Abriendo Mesa");
        let res = await app.request('/api/waiters/tables/RPT-T01/open', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', diners: 2 })
        });
        const openData = await res.json();
        orderCode = openData?.data?.body?.orderCode;
        console.log("orderCode:", orderCode);

        console.log("Setup 8: Comanda");
        res = await app.request('/api/waiters/tables/RPT-T01/orders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'ADMIN001', items: [{ dishCode: 'RPT-TACO', quantity: 1 }] })
        });
        const orderResp = await res.json();
        console.log("Comanda:", res.status, JSON.stringify(orderResp));

        const queryRes = await executeQuery(null, `SELECT oi.id FROM order_items oi JOIN order_headers oh ON oh.id = oi.order_id WHERE oh.code = $1 ORDER BY oi.id DESC LIMIT 1`, [orderCode]);
        itemId = queryRes[0]?.id;
        console.log("itemId:", itemId);

        console.log("Setup 9: Cocina Avanza");
        const r1 = await app.request(`/api/kitchen/items/${itemId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PREPARING' }) });
        console.log("PREPARING:", r1.status, JSON.stringify(await r1.json()));
        const r2 = await app.request(`/api/kitchen/items/${itemId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'READY' }) });
        console.log("READY:", r2.status, JSON.stringify(await r2.json()));

        console.log("Setup 10: Mesero Entrega");
        await app.request(`/api/waiters/tables/RPT-T01/items/${itemId}/collect`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeNumber: 'ADMIN001' }) });
        await app.request(`/api/waiters/tables/RPT-T01/items/${itemId}/deliver`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });

        console.log("Setup 11: Cerrar Mesa");
        await app.request('/api/waiters/tables/RPT-T01/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeNumber: 'ADMIN001' }) });

        console.log("Setup 12: Cajero Paga");
        res = await app.request('/api/admin/cashier/tables/RPT-T01/pay', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashierCode: 'ADMIN001', payments: [{ method: 'CASH', amount: 150 }], tip: 15 })
        });
        const d = await res.json();
        ticketFolio = d?.data?.body?.folio;
        console.log("Setup OK — ticketFolio:", ticketFolio);
    });

    // ── REPORTES DE VENTAS ────────────────────────────────────

    it('RPT-01 Obtiene resumen de ventas por rango de fecha', async () => {
        const res = await app.request('/api/inventory/reports/sales-summary?startDate=2026-01-01&endDate=2026-12-31', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
    });

    it('RPT-02 Rechaza consulta sin fechas (Gatekeeper 400)', async () => {
        const res = await app.request('/api/inventory/reports/sales-summary', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(400);
    });

    it('RPT-03 Rechaza rango con fecha inicio posterior a fecha fin', async () => {
        const res = await app.request('/api/inventory/reports/sales-summary?startDate=2026-12-31&endDate=2026-01-01', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.message || data.error).toContain('posterior');
    });

    it('RPT-04 Rechaza rango mayor a 1 año', async () => {
        const res = await app.request('/api/inventory/reports/sales-summary?startDate=2024-01-01&endDate=2026-12-31', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.message || data.error).toContain('año');
    });

    it('RPT-05 Obtiene top platillos con límite personalizado', async () => {
        const res = await app.request('/api/inventory/reports/top-dishes?startDate=2026-01-01&endDate=2026-12-31&limit=5', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
        expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it('RPT-06 Obtiene ventas por categoría exitosamente', async () => {
        const res = await app.request('/api/inventory/reports/sales-by-category?startDate=2026-01-01&endDate=2026-12-31', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);

        if (data.data.length > 0) {
            expect(data.data[0]).toHaveProperty('category_name');
            expect(data.data[0]).toHaveProperty('revenue');
        }
    });

    it('RPT-07 Obtiene ventas por mesero exitosamente', async () => {
        const res = await app.request('/api/inventory/reports/sales-by-waiter?startDate=2026-01-01&endDate=2026-12-31', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);

        if (data.data.length > 0) {
            expect(data.data[0]).toHaveProperty('waiter_name');
            expect(data.data[0]).toHaveProperty('total_revenue');
            expect(data.data[0]).toHaveProperty('total_tips');
        }
    });

    it('RPT-08 Obtiene detalle de ventas (tickets individuales)', async () => {
        const res = await app.request('/api/inventory/reports/sales?startDate=2026-01-01&endDate=2026-12-31', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);

        if (data.data.length > 0) {
            expect(data.data[0]).toHaveProperty('ticket_folio');
            expect(data.data[0]).toHaveProperty('dish_name');
            expect(data.data[0]).toHaveProperty('waiter_name');
        }
    });

    // ── DASHBOARD KPIs ────────────────────────────────────────

    it('KPI-01 Obtiene los KPIs del dashboard en tiempo real', async () => {
        const res = await app.request('/api/inventory/dashboard/kpis', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);

        // Verificar que los KPIs tienen las propiedades esperadas
        const kpis = data.data;
        expect(kpis).toHaveProperty('active_zones');
        expect(kpis).toHaveProperty('active_tables');
        expect(kpis).toHaveProperty('active_employees');
        expect(kpis).toHaveProperty('active_dishes');
        expect(kpis).toHaveProperty('today_tickets');
        expect(kpis).toHaveProperty('today_revenue');
        expect(kpis).toHaveProperty('open_orders');
        expect(kpis).toHaveProperty('items_below_minimum');

        // Los conteos deben ser numéricos >= 0
        expect(parseInt(kpis.active_zones)).toBeGreaterThanOrEqual(0);
        expect(parseInt(kpis.active_tables)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(kpis.today_revenue)).toBeGreaterThanOrEqual(0);
    });

    it('KPI-02 Los KPIs reflejan datos consistentes con la BD', async () => {
        const res = await app.request('/api/inventory/dashboard/kpis', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const kpis = (await res.json()).data;

        // Cross-check: active_zones >= 0 y active_tables >= 0
        // No puede haber más mesas activas que capacidad total
        const tables = parseInt(kpis.active_tables) || 0;
        const capacity = parseInt(kpis.total_capacity) || 0;

        if (tables > 0) {
            expect(capacity).toBeGreaterThan(0); // Si hay mesas, debe haber capacidad
        }

        // today_tips no puede exceder today_revenue
        const revenue = parseFloat(kpis.today_revenue) || 0;
        const tips = parseFloat(kpis.today_tips) || 0;
        expect(tips).toBeLessThanOrEqual(revenue + 0.01); // Margen de redondeo
    });

    afterAll(async () => {
        // Primero eliminar todos los registros de órdenes de RPT-T01 (cualquier corrida)
        await executeQuery(null, `DELETE FROM payments WHERE order_id IN (SELECT oh.id FROM order_headers oh JOIN restaurant_tables t ON t.id = oh.table_id WHERE t.code = 'RPT-T01')`);
        await executeQuery(null, `DELETE FROM tickets  WHERE order_id IN (SELECT oh.id FROM order_headers oh JOIN restaurant_tables t ON t.id = oh.table_id WHERE t.code = 'RPT-T01')`);
        await executeQuery(null, `DELETE FROM order_items WHERE order_id IN (SELECT oh.id FROM order_headers oh JOIN restaurant_tables t ON t.id = oh.table_id WHERE t.code = 'RPT-T01')`);
        await executeQuery(null, `DELETE FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'RPT-T01')`);
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code = 'RPT-TACO'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = 'RPT-CAT'`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'RPT-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = 'RPT-ZONE'`);
    });
});
