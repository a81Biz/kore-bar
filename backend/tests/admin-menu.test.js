// ============================================================
// admin-menu.test.js
// Módulo: Administración de Menú — Categorías y Platillos
// Códigos: MENU-xx
// ============================================================
import { describe, it, expect, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Menú', () => {

    // ── CATEGORÍAS ────────────────────────────────────────────

    it('MENU-01 Crea una categoría nueva', async () => {
        const res = await app.request('/api/admin/menu/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: 'TEST-CAT', name: 'Categoría de Prueba', description: 'Prueba TDD' })
        });
        expect(res.status).toBe(200);
    });

    it('MENU-02 Rechaza si el código de categoría ya existe', async () => {
        const res = await app.request('/api/admin/menu/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: 'TEST-CAT', name: 'Clon' })
        });
        expect(res.status).toBe(400);
    });

    it('MENU-03 Devuelve la lista de categorías incluyendo la creada', async () => {
        const res = await app.request('/api/admin/menu/categories', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        const data = json.data || json;
        expect(Array.isArray(data.categories)).toBe(true);
        expect(data.categories.find(c => c.categoryCode === 'TEST-CAT')).toBeDefined();
    });

    it('MENU-04 Actualiza el nombre de una categoría', async () => {
        const res = await app.request('/api/admin/menu/categories/TEST-CAT', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Prueba Actualizada', description: '', isActive: true })
        });
        expect(res.status).toBe(200);
    });

    it('MENU-05 Elimina una categoría sin platillos exitosamente', async () => {
        const res = await app.request('/api/admin/menu/categories/TEST-CAT', { method: 'DELETE' });
        expect(res.status).toBe(200);
    });

    // ── PLATILLOS ─────────────────────────────────────────────

    it('MENU-06 Crea una categoría base para los platillos (setup)', async () => {
        const res = await app.request('/api/admin/menu/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: 'TESTP-CAT-DISH', name: 'Cat Platillos' })
        });
        expect(res.status).toBe(200);
    });

    it('MENU-07 Crea un platillo nuevo en una categoría existente', async () => {
        const res = await app.request('/api/admin/menu/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishCode: 'TEST-PL-01', categoryCode: 'TESTP-CAT-DISH', name: 'Taco de Prueba', description: 'Rico taco', price: 25.50 })
        });
        expect(res.status).toBe(200);
    });

    it('MENU-08 Rechaza platillo si la categoría no existe', async () => {
        const res = await app.request('/api/admin/menu/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishCode: 'TEST-PL-02', categoryCode: 'CAT-FANTASMA', name: 'Taco Error', price: 10 })
        });
        expect(res.status).toBe(400);
    });

    it('MENU-09 Devuelve la lista de platillos con datos de categoría', async () => {
        const res = await app.request('/api/admin/menu/dishes', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        const data = json.data || json;
        expect(Array.isArray(data.dishes)).toBe(true);

        const platillo = data.dishes.find(d => d.dishCode === 'TEST-PL-01');
        expect(platillo).toBeDefined();
        expect(platillo.categoryName).toBe('Cat Platillos');
        expect(platillo.hasRecipe).toBe(false);
    });

    it('MENU-10 Actualiza precio y estado de un platillo', async () => {
        const res = await app.request('/api/admin/menu/dishes/TEST-PL-01', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryCode: 'TESTP-CAT-DISH', name: 'Taco de Prueba', price: 30.00, isActive: true })
        });
        expect(res.status).toBe(200);
    });

    it('MENU-11 Impide borrar una categoría con platillos activos', async () => {
        const res = await app.request('/api/admin/menu/categories/TESTP-CAT-DISH', { method: 'DELETE' });
        expect(res.status).toBe(409);
    });

    it('MENU-12 Elimina un platillo exitosamente', async () => {
        const res = await app.request('/api/admin/menu/dishes/TEST-PL-01', { method: 'DELETE' });
        expect(res.status).toBe(200);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM menu_dishes     WHERE code LIKE 'TEST-%'`);
        await executeQuery(null, `DELETE FROM menu_categories WHERE code LIKE 'TEST-%'`);
    });
});
