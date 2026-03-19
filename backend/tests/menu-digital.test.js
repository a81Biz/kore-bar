// ============================================================
// menu-digital.test.js
// Módulo: Menú Público y Llamado a Mesero
// Códigos: PUB-xx
// ============================================================
import { describe, it, expect, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Público — Menú Digital', () => {

    // Setup inline: crear categorías y platillos de prueba
    it('PUB-00 Setup: crea datos de prueba para el menú público', async () => {
        let res;

        res = await app.request('/api/admin/menu/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryCode: 'TEST-PUB-CAT', name: 'Categoría Pública' }) });
        expect(res.status).toBe(200);

        res = await app.request('/api/admin/menu/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryCode: 'TEST-HIDDEN-CAT', name: 'Categoría Oculta' }) });
        expect(res.status).toBe(200);

        res = await app.request('/api/admin/menu/categories/TEST-HIDDEN-CAT', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Categoría Oculta', isActive: false }) });
        expect(res.status).toBe(200);

        res = await app.request('/api/admin/menu/dishes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dishCode: 'TEST-PUB-DISH', categoryCode: 'TEST-PUB-CAT', name: 'Platillo Público', price: 100 }) });
        expect(res.status).toBe(200);

        res = await app.request('/api/admin/menu/dishes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dishCode: 'TEST-PUB-HIDDEN', categoryCode: 'TEST-PUB-CAT', name: 'Platillo Oculto', price: 90 }) });
        expect(res.status).toBe(200);

        res = await app.request('/api/admin/menu/dishes/TEST-PUB-HIDDEN', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryCode: 'TEST-PUB-CAT', name: 'Platillo Oculto', price: 90, isActive: false }) });
        expect(res.status).toBe(200);
    });

    // ── MENÚ PÚBLICO ──────────────────────────────────────────

    it('PUB-01 Devuelve el menú público agrupado por categoría ocultando inactivos', async () => {
        const res = await app.request('/api/menu/public', { method: 'GET' });
        expect(res.status).toBe(200);

        const json = await res.json();
        const data = json.data || json;
        expect(Array.isArray(data)).toBe(true);

        // La categoría oculta NO debe aparecer
        expect(data.find(c => c.categoryCode === 'TEST-HIDDEN-CAT')).toBeUndefined();

        // La categoría visible SÍ debe aparecer con sus platillos
        const pubCat = data.find(c => c.categoryCode === 'TEST-PUB-CAT');
        expect(pubCat).toBeDefined();
        expect(Array.isArray(pubCat.dishes)).toBe(true);

        // Platillo visible presente
        expect(pubCat.dishes.find(d => d.dishCode === 'TEST-PUB-DISH')).toBeDefined();

        // Platillo oculto ausente
        expect(pubCat.dishes.find(d => d.dishCode === 'TEST-PUB-HIDDEN')).toBeUndefined();
    });

    // ── LLAMADO A MESERO ──────────────────────────────────────

    it('PUB-02 Setup: crea zona y mesa de prueba para llamada', async () => {
        await executeQuery(null, `INSERT INTO restaurant_zones  (code, name)                   VALUES ('TEST-ZONE-PUB', 'Test Zone Pub') ON CONFLICT DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity)      VALUES ('TEST-TBL-PUB', (SELECT id FROM restaurant_zones WHERE code='TEST-ZONE-PUB'), 4) ON CONFLICT DO NOTHING`);
    });

    it('PUB-03 Registra un llamado al mesero desde una mesa válida', async () => {
        const res = await app.request('/api/tables/TEST-TBL-PUB/call-waiter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'ORDER' })
        });
        expect(res.status).toBe(200);
    });

    it('PUB-04 Rechaza llamada si la mesa no existe', async () => {
        const res = await app.request('/api/tables/MESA-FALSA/call-waiter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'BILL' })
        });
        expect(res.status).not.toBe(200);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM waiter_calls     WHERE table_id IN (SELECT id FROM restaurant_tables WHERE code = 'TEST-TBL-PUB')`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'TEST-TBL-PUB'`);
        await executeQuery(null, `DELETE FROM restaurant_zones  WHERE code = 'TEST-ZONE-PUB'`);
        await executeQuery(null, `DELETE FROM menu_dishes       WHERE code LIKE 'TEST-PUB-%'`);
        await executeQuery(null, `DELETE FROM menu_categories   WHERE code LIKE 'TEST-PUB-%' OR code LIKE 'TEST-HIDDEN-%'`);
    });
});
