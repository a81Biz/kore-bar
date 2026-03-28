// ============================================================
// kds-routing-category.test.js — v4
// Usa ADMIN001 del seed (como waiter.test.js).
// Mismo patrón SQL: ON CONFLICT, sin status en tables.
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo KDS — Routing por Categoría (route_to_kds)', () => {
    const PIN = '123456';

    beforeAll(async () => {
        // PIN de ADMIN001 via API (bcrypt) — mismo patrón que waiter.test.js
        await app.request('/api/admin/employees/ADMIN001/reset-pin', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: PIN })
        });

        // Zona + Mesa
        await executeQuery(null, `INSERT INTO restaurant_zones (code, name) VALUES ('RTE-ZONE', 'Zona RTE') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity) VALUES ('RTE-T01', (SELECT id FROM restaurant_zones WHERE code='RTE-ZONE'), 4) ON CONFLICT (code) DO NOTHING`);

        // Categoría COCINA (route_to_kds = true)
        await executeQuery(null, `INSERT INTO menu_categories (code, name, route_to_kds) VALUES ('RTE-COCINA', 'Platillos RTE', true) ON CONFLICT (code) DO UPDATE SET route_to_kds = true`);
        // Categoría BARRA (route_to_kds = false)
        await executeQuery(null, `INSERT INTO menu_categories (code, name, route_to_kds) VALUES ('RTE-BARRA', 'Bebidas RTE', false) ON CONFLICT (code) DO UPDATE SET route_to_kds = false`);

        // Platillo COCINA con receta → has_recipe = true
        await executeQuery(null, `
            INSERT INTO menu_dishes (code, category_id, name, price, has_recipe, is_active)
            VALUES ('RTE-TACO', (SELECT id FROM menu_categories WHERE code='RTE-COCINA'), 'Taco RTE', 50, true, true)
            ON CONFLICT (code) DO NOTHING
        `);
        // Platillo BARRA sin receta → has_recipe = false
        await executeQuery(null, `
            INSERT INTO menu_dishes (code, category_id, name, price, has_recipe, is_active)
            VALUES ('RTE-CERVEZA', (SELECT id FROM menu_categories WHERE code='RTE-BARRA'), 'Cerveza RTE', 45, false, true)
            ON CONFLICT (code) DO NOTHING
        `);

        // Insumo + Receta para el taco (para que has_recipe sea real)
        await executeQuery(null, `INSERT INTO inventory_items (code, name, unit_measure) VALUES ('RTE-INS-TORT', 'Tortilla RTE', 'PZ') ON CONFLICT (code) DO NOTHING`);
        const [dish] = await executeQuery(null, `SELECT id FROM menu_dishes WHERE code = 'RTE-TACO'`);
        const [ing] = await executeQuery(null, `SELECT id FROM inventory_items WHERE code = 'RTE-INS-TORT'`);
        if (dish && ing) {
            await executeQuery(null, `INSERT INTO dish_recipes (dish_id, item_id, quantity_required) VALUES ($1, $2, 2) ON CONFLICT (dish_id, item_id) DO NOTHING`, [dish.id, ing.id]);
        }

        // Limpiar órdenes previas de esta mesa
        await executeQuery(null, `UPDATE order_headers SET status = 'CLOSED' WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'RTE-T01') AND status IN ('OPEN','AWAITING_PAYMENT')`);
    });

    afterAll(async () => {
        await executeQuery(null, `DELETE FROM order_items WHERE order_id IN (SELECT id FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'RTE-T01'))`);
        await executeQuery(null, `DELETE FROM order_headers WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = 'RTE-T01')`);
        await executeQuery(null, `DELETE FROM dish_recipes WHERE dish_id IN (SELECT id FROM menu_dishes WHERE code LIKE 'RTE-%')`);
        await executeQuery(null, `DELETE FROM menu_dishes WHERE code LIKE 'RTE-%'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code LIKE 'RTE-%'`);
        await executeQuery(null, `DELETE FROM inventory_items WHERE code = 'RTE-INS-TORT'`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'RTE-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones WHERE code = 'RTE-ZONE'`);
    });

    it('RTE-01 Item de categoría route_to_kds=true va a PENDING_KITCHEN', async () => {
        const res = await app.request('/api/waiters/tables/RTE-T01/orders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'ADMIN001',
                items: [{ dishCode: 'RTE-TACO', quantity: 1, notes: '' }]
            })
        });
        expect(res.status).toBe(200);

        const items = await executeQuery(null, `
            SELECT oi.status FROM order_items oi
            JOIN menu_dishes md ON md.id = oi.dish_id
            JOIN order_headers oh ON oh.id = oi.order_id
            JOIN restaurant_tables rt ON rt.id = oh.table_id
            WHERE rt.code = 'RTE-T01' AND md.code = 'RTE-TACO'
        `);
        expect(items.length).toBeGreaterThanOrEqual(1);
        expect(items[0].status).toBe('PENDING_KITCHEN');
    });

    it('RTE-02 Item de categoría route_to_kds=false va a PENDING_FLOOR', async () => {
        const res = await app.request('/api/waiters/tables/RTE-T01/orders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'ADMIN001',
                items: [{ dishCode: 'RTE-CERVEZA', quantity: 2, notes: '' }]
            })
        });
        expect(res.status).toBe(200);

        const items = await executeQuery(null, `
            SELECT oi.status FROM order_items oi
            JOIN menu_dishes md ON md.id = oi.dish_id
            JOIN order_headers oh ON oh.id = oi.order_id
            JOIN restaurant_tables rt ON rt.id = oh.table_id
            WHERE rt.code = 'RTE-T01' AND md.code = 'RTE-CERVEZA'
        `);
        expect(items.length).toBeGreaterThanOrEqual(1);
        expect(items[0].status).toBe('PENDING_FLOOR');
    });

    it('RTE-03 El menú público incluye routeToKds en cada categoría', async () => {
        const res = await app.request('/api/menu/public', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        const categories = json.data || [];
        const cocina = categories.find(c => c.categoryCode === 'RTE-COCINA');
        const barra = categories.find(c => c.categoryCode === 'RTE-BARRA');
        expect(cocina).toBeDefined();
        expect(cocina.routeToKds).toBe(true);
        expect(barra).toBeDefined();
        expect(barra.routeToKds).toBe(false);
    });
});