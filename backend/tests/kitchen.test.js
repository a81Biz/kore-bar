// ============================================================
// kitchen.test.js
// Módulo: Cocina — Insumos, Recetas y Ficha Técnica
// Códigos: COC-xx
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Cocina — Recetario', () => {

    // Setup: categoría y platillo sin receta para la bandeja de pendientes
    beforeAll(async () => {
        await executeQuery(null, `INSERT INTO menu_categories (code, name) VALUES ('TEST-CAT-K', 'Cocina Test') ON CONFLICT DO NOTHING`);
        await executeQuery(null, `INSERT INTO menu_dishes (code, category_id, name, price) VALUES ('TEST-DISH-K', (SELECT id FROM menu_categories WHERE code='TEST-CAT-K'), 'Platillo Cocina', 100) ON CONFLICT DO NOTHING`);
    });

    it('COC-01 Devuelve la bandeja de platillos sin receta (has_recipe = false)', async () => {
        const res = await app.request('/api/kitchen/dishes/pending', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.data.dishes)).toBe(true);
        expect(json.data.dishes.find(d => d.dishCode === 'TEST-DISH-K')).toBeDefined();
    });

    it('COC-02 Crea un insumo nuevo en inventory_items', async () => {
        const res = await app.request('/api/kitchen/ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'TEST-ING-01', name: 'Tomate Prueba', unit: 'KG' })
        });
        expect(res.status).toBe(200);
    });

    it('COC-03 Devuelve el catálogo de insumos activos', async () => {
        const res = await app.request('/api/kitchen/ingredients', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.ingredients.find(i => i.code === 'TEST-ING-01')).toBeDefined();
    });

    it('COC-04 Agrega un ingrediente a la receta y activa has_recipe en el platillo', async () => {
        const res = await app.request('/api/kitchen/recipes/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishCode: 'TEST-DISH-K', ingredientCode: 'TEST-ING-01', quantity: 0.150 })
        });
        expect(res.status).toBe(200);

        // Verificación cruzada: el platillo ya no debe estar en pendientes
        const resBandeja = await app.request('/api/kitchen/dishes/pending', { method: 'GET' });
        const jsonBandeja = await resBandeja.json();
        expect(jsonBandeja.data.dishes.find(d => d.dishCode === 'TEST-DISH-K')).toBeUndefined();
    });

    it('COC-05 Devuelve el catálogo de recetario (has_recipe = true)', async () => {
        const res = await app.request('/api/kitchen/dishes/finished', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.data.dishes)).toBe(true);
        const platillo = json.data.dishes.find(d => d.dishCode === 'TEST-DISH-K');
        expect(platillo).toBeDefined();
        expect(platillo.name).toBe('Platillo Cocina');
    });

    it('COC-06 Devuelve el BOM (ingredientes) de un platillo', async () => {
        const res = await app.request('/api/kitchen/recipes/TEST-DISH-K/bom', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.data.bom)).toBe(true);
        expect(json.data.bom[0].code).toBe('TEST-ING-01');
        expect(json.data.bom[0].quantity).toBe(0.150);
    });

    it('COC-07 Devuelve 404 para el BOM de un platillo sin receta', async () => {
        const res = await app.request('/api/kitchen/recipes/PLATILLO-FALSO/bom', { method: 'GET' });
        expect(res.status).toBe(404);
    });

    it('COC-08 Actualiza la ficha técnica (método de preparación e imagen)', async () => {
        const payload = { preparationMethod: '1. Picar tomate\n2. Servir frío.', imageUrl: '/uploads/test.jpg' };
        const res = await app.request('/api/kitchen/recipes/TEST-DISH-K/tech-sheet', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        expect(res.status).toBe(200);

        // Verificación cruzada: consultar recetario y validar cambios
        const resCheck = await app.request('/api/kitchen/dishes/finished', { method: 'GET' });
        const jsonCheck = await resCheck.json();
        const platillo = jsonCheck.data.dishes.find(d => d.dishCode === 'TEST-DISH-K');
        expect(platillo.preparationMethod).toBe(payload.preparationMethod);
        expect(platillo.imageUrl).toBe(payload.imageUrl);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        // dish_recipes se limpia por CASCADE al borrar el platillo
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code = 'TEST-DISH-K'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code = 'TEST-CAT-K'`);
        // Limpiar insumo de prueba de inventory_items
        await executeQuery(null, `DELETE FROM inventory_items WHERE code = 'TEST-ING-01'`);
    });
});
