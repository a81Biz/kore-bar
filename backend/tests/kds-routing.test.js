// ============================================================
// kds-routing.test.js
// Módulo: KDS Routing explícito por categoría (route_to_kds)
// Códigos: KDSR-xx
//
// Flujo cubierto:
//   1. Categoría con route_to_kds=true  → item va a PENDING_KITCHEN
//   2. Categoría con route_to_kds=false → item va a PENDING_FLOOR
//      aunque el platillo tenga receta (Ej: coctel con BOM)
//   3. Items PENDING_FLOOR nunca aparecen en GET /kitchen/board
//   4. La columna route_to_kds existe con DEFAULT TRUE
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo KDS — Routing explícito por categoría (route_to_kds)', () => {

    const TEST_ZONE = 'KDSR-ZONE';
    const TEST_TABLE = 'KDSR-T01';
    const TEST_EMP = 'ADMIN001';
    const CAT_COCINA = 'KDSR-CAT-FOOD';   // route_to_kds = true (default)
    const CAT_BEBIDAS = 'KDSR-CAT-DRINK';  // route_to_kds = false
    const DISH_TACO = 'KDSR-TACO-01';    // con receta + route_to_kds=true → PENDING_KITCHEN
    const DISH_AGUA = 'KDSR-AGUA-01';    // sin receta + route_to_kds=false → PENDING_FLOOR
    const DISH_MARGARITA = 'KDSR-MARGARITA-01'; // con receta + route_to_kds=false → PENDING_FLOOR

    beforeAll(async () => {
        // Zona y mesa
        await executeQuery(null, `
            INSERT INTO restaurant_zones (code, name)
            VALUES ($1, 'Zona KDSR Test') ON CONFLICT (code) DO NOTHING
        `, [TEST_ZONE]);
        await executeQuery(null, `
            INSERT INTO restaurant_tables (code, zone_id, capacity)
            VALUES ($1, (SELECT id FROM restaurant_zones WHERE code = $2), 4)
            ON CONFLICT (code) DO NOTHING
        `, [TEST_TABLE, TEST_ZONE]);

        // PIN para mesero de prueba
        await executeQuery(null, `
            UPDATE employees SET pin_code = '123456' WHERE employee_number = $1
        `, [TEST_EMP]);

        // Categoría COCINA (route_to_kds = TRUE por default)
        await app.request('/api/admin/menu/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: CAT_COCINA, name: 'Platillos KDSR' })
        });

        // Categoría BEBIDAS (route_to_kds = FALSE — se actualiza directamente)
        await app.request('/api/admin/menu/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: CAT_BEBIDAS, name: 'Bebidas KDSR' })
        });
        await executeQuery(null, `
            UPDATE menu_categories SET route_to_kds = false WHERE code = $1
        `, [CAT_BEBIDAS]);

        // Platillo TACO — categoría cocina, se le da receta via API cocina
        await app.request('/api/admin/menu/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishCode: DISH_TACO, categoryCode: CAT_COCINA,
                name: 'Taco KDSR', price: 90
            })
        });
        await app.request('/api/kitchen/ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'KDSR-ING-TORTILLA', name: 'Tortilla KDSR', unit: 'PZ' })
        });
        await app.request('/api/kitchen/recipes/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishCode: DISH_TACO, ingredientCode: 'KDSR-ING-TORTILLA', quantity: 3
            })
        });

        // Platillo AGUA — categoría bebidas, SIN receta
        await app.request('/api/admin/menu/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishCode: DISH_AGUA, categoryCode: CAT_BEBIDAS,
                name: 'Agua Mineral KDSR', price: 35
            })
        });

        // Platillo MARGARITA — categoría bebidas, CON receta (caso clave)
        await app.request('/api/admin/menu/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishCode: DISH_MARGARITA, categoryCode: CAT_BEBIDAS,
                name: 'Margarita KDSR', price: 95
            })
        });
        await app.request('/api/kitchen/ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'KDSR-ING-TEQUILA', name: 'Tequila KDSR', unit: 'ML' })
        });
        await app.request('/api/kitchen/recipes/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishCode: DISH_MARGARITA, ingredientCode: 'KDSR-ING-TEQUILA', quantity: 60
            })
        });
    });

    afterAll(async () => {
        await executeQuery(null, `
            DELETE FROM order_items WHERE order_id IN (
                SELECT id FROM order_headers
                WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = $1)
            )
        `, [TEST_TABLE]);
        await executeQuery(null, `
            DELETE FROM order_headers
            WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = $1)
        `, [TEST_TABLE]);
        await executeQuery(null, `
            DELETE FROM dish_recipes WHERE dish_id IN (
                SELECT id FROM menu_dishes WHERE code IN ($1, $2)
            )
        `, [DISH_TACO, DISH_MARGARITA]);
        await executeQuery(null, `
            DELETE FROM menu_dishes WHERE code IN ($1, $2, $3)
        `, [DISH_TACO, DISH_AGUA, DISH_MARGARITA]);
        await executeQuery(null, `
            DELETE FROM menu_categories WHERE code IN ($1, $2)
        `, [CAT_COCINA, CAT_BEBIDAS]);
        await executeQuery(null, `
            DELETE FROM inventory_items WHERE code IN ('KDSR-ING-TORTILLA', 'KDSR-ING-TEQUILA')
        `);
        await executeQuery(null, `
            DELETE FROM restaurant_tables WHERE code = $1
        `, [TEST_TABLE]);
        await executeQuery(null, `
            DELETE FROM restaurant_zones WHERE code = $1
        `, [TEST_ZONE]);
        await executeQuery(null, `
            UPDATE employees SET pin_code = NULL WHERE employee_number = $1
        `, [TEST_EMP]);
    });

    // Helper: abrir mesa y enviar un platillo
    const sendDish = async (dishCode) => {
        // Limpiar orden previa si existe
        await executeQuery(null, `
            UPDATE order_headers SET status = 'CLOSED'
            WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = $1)
              AND status IN ('OPEN', 'AWAITING_PAYMENT')
        `, [TEST_TABLE]);

        await app.request(`/api/waiters/tables/${TEST_TABLE}/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: TEST_EMP, diners: 2 })
        });
        await app.request(`/api/waiters/tables/${TEST_TABLE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP,
                items: [{ dishCode, quantity: 1 }]
            })
        });
    };

    // Helper: obtener el último item del platillo en la mesa
    const getLastItemStatus = async (dishCode) => {
        const rows = await executeQuery(null, `
            SELECT oi.status
            FROM order_items oi
            JOIN order_headers oh ON oh.id = oi.order_id
            JOIN restaurant_tables rt ON rt.id = oh.table_id
            JOIN menu_dishes md ON md.id = oi.dish_id
            WHERE rt.code = $1 AND md.code = $2
            ORDER BY oi.created_at DESC
            LIMIT 1
        `, [TEST_TABLE, dishCode]);
        return rows[0]?.status;
    };


    // ═══════════════════════════════════════════════════════════
    // Migration: columna route_to_kds
    // ═══════════════════════════════════════════════════════════

    it('KDSR-01 La columna route_to_kds existe en menu_categories con tipo boolean', async () => {
        const check = await executeQuery(null, `
            SELECT data_type
            FROM information_schema.columns
            WHERE table_name  = 'menu_categories'
              AND column_name = 'route_to_kds'
        `);
        expect(check.length).toBe(1);
        expect(check[0].data_type).toBe('boolean');
    });

    it('KDSR-02 El default de route_to_kds es TRUE (retrocompatible con categorías existentes)', async () => {
        const check = await executeQuery(null, `
            SELECT column_default
            FROM information_schema.columns
            WHERE table_name  = 'menu_categories'
              AND column_name = 'route_to_kds'
        `);
        expect(check[0].column_default).toBe('true');
    });

    it('KDSR-03 La categoría de cocina tiene route_to_kds=true', async () => {
        const check = await executeQuery(null, `
            SELECT route_to_kds FROM menu_categories WHERE code = $1
        `, [CAT_COCINA]);
        expect(check[0].route_to_kds).toBe(true);
    });

    it('KDSR-04 La categoría de bebidas tiene route_to_kds=false después de actualizar', async () => {
        const check = await executeQuery(null, `
            SELECT route_to_kds FROM menu_categories WHERE code = $1
        `, [CAT_BEBIDAS]);
        expect(check[0].route_to_kds).toBe(false);
    });


    // ═══════════════════════════════════════════════════════════
    // Routing al enviar comanda — sp_pos_submit_order actualizado
    // ═══════════════════════════════════════════════════════════

    it('KDSR-05 Platillo con receta y route_to_kds=true → status PENDING_KITCHEN en BD', async () => {
        await sendDish(DISH_TACO);
        const status = await getLastItemStatus(DISH_TACO);
        expect(status).toBe('PENDING_KITCHEN');
    });

    it('KDSR-06 Bebida sin receta y route_to_kds=false → status PENDING_FLOOR en BD', async () => {
        await sendDish(DISH_AGUA);
        const status = await getLastItemStatus(DISH_AGUA);
        expect(status).toBe('PENDING_FLOOR');
    });

    it('KDSR-07 Coctel CON receta pero route_to_kds=false → status PENDING_FLOOR en BD', async () => {
        // Caso clave: el routing es por categoría, no por has_recipe
        // La margarita tiene BOM pero su categoría (Bebidas) tiene route_to_kds=false
        await sendDish(DISH_MARGARITA);
        const status = await getLastItemStatus(DISH_MARGARITA);
        expect(status).toBe('PENDING_FLOOR');
    });

    it('KDSR-08 El tablero de cocina no incluye items de bebidas (PENDING_FLOOR)', async () => {
        await sendDish(DISH_AGUA);

        const res = await app.request('/api/kitchen/board', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();

        // Aplanar los tres grupos del tablero
        const board = json.data.board;
        const allItems = [
            ...(board.pending || []),
            ...(board.preparing || []),
            ...(board.ready || [])
        ];
        // El board devuelve dishName (no dishCode) — ver getKitchenBoard en kitchen.helper.js
        const drinkInKds = allItems.find(i =>
            i.dishName === 'Agua Mineral KDSR' || i.dishName === 'Margarita KDSR'
        );
        expect(drinkInKds).toBeUndefined();
    });

    it('KDSR-09 El tablero de cocina SÍ incluye el taco (PENDING_KITCHEN)', async () => {
        await sendDish(DISH_TACO);

        const res = await app.request('/api/kitchen/board', { method: 'GET' });
        const json = await res.json();
        const board = json.data.board;
        const allItems = [
            ...(board.pending || []),
            ...(board.preparing || []),
            ...(board.ready || [])
        ];
        // El board devuelve dishName (no dishCode) — ver getKitchenBoard en kitchen.helper.js
        const tacoInKds = allItems.find(i => i.dishName === 'Taco KDSR');
        expect(tacoInKds).toBeDefined();
    });

    it('KDSR-10 Una comanda con platillos mixtos enruta cada item correctamente', async () => {
        // Limpiar orden previa
        await executeQuery(null, `
            UPDATE order_headers SET status = 'CLOSED'
            WHERE table_id = (SELECT id FROM restaurant_tables WHERE code = $1)
              AND status IN ('OPEN', 'AWAITING_PAYMENT')
        `, [TEST_TABLE]);

        await app.request(`/api/waiters/tables/${TEST_TABLE}/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: TEST_EMP, diners: 3 })
        });

        await app.request(`/api/waiters/tables/${TEST_TABLE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP,
                items: [
                    { dishCode: DISH_TACO, quantity: 1 },  // → PENDING_KITCHEN
                    { dishCode: DISH_AGUA, quantity: 1 },  // → PENDING_FLOOR
                    { dishCode: DISH_MARGARITA, quantity: 1 }   // → PENDING_FLOOR
                ]
            })
        });

        const items = await executeQuery(null, `
            SELECT md.code AS dish_code, oi.status
            FROM order_items oi
            JOIN order_headers oh ON oh.id = oi.order_id
            JOIN restaurant_tables rt ON rt.id = oh.table_id
            JOIN menu_dishes md ON md.id = oi.dish_id
            WHERE rt.code = $1
              AND oh.status = 'OPEN'
              AND md.code IN ($2, $3, $4)
        `, [TEST_TABLE, DISH_TACO, DISH_AGUA, DISH_MARGARITA]);

        const statusMap = Object.fromEntries(items.map(i => [i.dish_code, i.status]));

        expect(statusMap[DISH_TACO]).toBe('PENDING_KITCHEN');
        expect(statusMap[DISH_AGUA]).toBe('PENDING_FLOOR');
        expect(statusMap[DISH_MARGARITA]).toBe('PENDING_FLOOR');
    });
});