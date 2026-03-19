// ============================================================
// admin-floor.test.js
// Módulo: Gestión de Piso — Zonas, Mesas y Asignaciones
// Códigos: PISO-xx
// ============================================================
import { describe, it, expect, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Gestión de Piso', () => {
    const today = new Date().toISOString().split('T')[0];

    // ── ZONAS ─────────────────────────────────────────────────

    it('PISO-01 Crea una zona nueva exitosamente', async () => {
        const res = await app.request('/api/admin/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: 'TEST-TERR', name: 'Terraza de Pruebas' })
        });
        expect(res.status).toBe(200);
    });

    it('PISO-02 Rechaza si el código de zona ya existe', async () => {
        const res = await app.request('/api/admin/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: 'TEST-TERR', name: 'Terraza Clonada' })
        });
        expect(res.status).toBe(400);
    });

    it('PISO-03 Rechaza si falta el código de zona (Gatekeeper)', async () => {
        const res = await app.request('/api/admin/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Sin Código' })
        });
        expect(res.status).toBe(400);
    });

    it('PISO-04 Actualiza el nombre de una zona', async () => {
        const res = await app.request('/api/admin/zones/TEST-TERR', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Terraza VIP', isActive: true })
        });
        expect(res.status).toBe(200);
    });

    it('PISO-05 Devuelve el catálogo de zonas', async () => {
        const res = await app.request('/api/admin/zones', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    // ── MESAS ─────────────────────────────────────────────────

    it('PISO-06 Crea una mesa dentro de una zona existente', async () => {
        const res = await app.request('/api/admin/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: 'TEST-T01', zoneCode: 'TEST-TERR', capacity: 4 })
        });
        expect(res.status).toBe(200);
    });

    it('PISO-07 Rechaza mesa con capacidad 0', async () => {
        const res = await app.request('/api/admin/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: 'TEST-T02', zoneCode: 'TEST-TERR', capacity: 0 })
        });
        expect(res.status).toBe(400);
    });

    it('PISO-08 Rechaza mesa si la zona no existe', async () => {
        const res = await app.request('/api/admin/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: 'TEST-T03', zoneCode: 'ZONA-FALSA', capacity: 2 })
        });
        expect(res.status).toBe(400);
    });

    it('PISO-09 Actualiza la capacidad de una mesa', async () => {
        const res = await app.request('/api/admin/tables/TEST-T01', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: 'TEST-TERR', capacity: 8, isActive: true })
        });
        expect(res.status).toBe(200);
    });

    it('PISO-10 Devuelve el catálogo de mesas', async () => {
        const res = await app.request('/api/admin/tables', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    // ── ASIGNACIONES ──────────────────────────────────────────

    it('PISO-11 Crea una asignación para un día', async () => {
        const res = await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'TEST-EMP-01', zoneCode: 'TEST-TERR', shift: 'MATUTINO', assignmentDate: today, recurrence: 'DIA' })
        });
        expect(res.status).toBe(200);
    });

    it('PISO-12 Rechaza asignación si la zona no existe', async () => {
        const res = await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'TEST-EMP-01', zoneCode: 'ZONA-FANTASMA', shift: 'MATUTINO', assignmentDate: today, recurrence: 'DIA' })
        });
        expect(res.status).toBe(400);
    });

    it('PISO-13 Recupera las asignaciones del día', async () => {
        const res = await app.request(`/api/admin/assignments?date=${today}`, { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        const data = json.data || json;
        expect(Array.isArray(data.assignments)).toBe(true);
        expect(data.assignments.find(a => a.employeeNumber === 'TEST-EMP-01')).toBeDefined();
    });

    it('PISO-14 Crea asignación SEMANA y genera 7 registros', async () => {
        const res = await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'TEST-EMP-02', zoneCode: 'TEST-TERR', shift: 'VESPERTINO', assignmentDate: today, recurrence: 'SEMANA' })
        });
        expect(res.status).toBe(200);

        const checkRes = await executeQuery(null, `SELECT COUNT(*) AS total FROM restaurant_assignments WHERE employee_number = 'TEST-EMP-02'`);
        expect(parseInt(checkRes[0].total)).toBe(7);
    });

    it('PISO-15 [Anti-Fatiga] Rechaza doble turno del mismo empleado en el mismo día (409)', async () => {
        const res = await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'TEST-EMP-01', zoneCode: 'TEST-TERR', shift: 'VESPERTINO', assignmentDate: today, recurrence: 'DIA' })
        });
        expect(res.status).toBe(409);
    });

    it('PISO-16 [Sobrecupo] Rechaza si la zona ya está ocupada en ese turno (409)', async () => {
        const res = await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'TEST-EMP-03', zoneCode: 'TEST-TERR', shift: 'MATUTINO', assignmentDate: today, recurrence: 'DIA' })
        });
        expect(res.status).toBe(409);
    });

    it('PISO-17 [Rollback Recurrencia] Aborta toda la semana si un día genera conflicto (409)', async () => {
        const res = await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: 'TEST-EMP-04', zoneCode: 'TEST-TERR', shift: 'VESPERTINO', assignmentDate: today, recurrence: 'DIA' })
        });
        expect(res.status).toBe(409);
    });

    it('PISO-18 Elimina una asignación exitosamente', async () => {
        const getRes = await app.request(`/api/admin/assignments?date=${today}`, { method: 'GET' });
        const json = await getRes.json();
        const data = json.data || json;
        const asig = data.assignments.find(a => a.employeeNumber === 'TEST-EMP-01');

        const delRes = await app.request(`/api/admin/assignments/${asig.id}`, { method: 'DELETE' });
        expect(delRes.status).toBe(200);
    });

    // ── SMART DELETE ──────────────────────────────────────────

    it('PISO-19 Impide borrar una zona si tiene mesas activas', async () => {
        const res = await app.request('/api/admin/zones/TEST-TERR', { method: 'DELETE' });
        expect(res.status).toBe(400);
    });

    it('PISO-20 Borra una mesa exitosamente', async () => {
        const res = await app.request('/api/admin/tables/TEST-T01', { method: 'DELETE' });
        expect(res.status).toBe(200);
    });

    it('PISO-21 Borra la zona una vez que está vacía', async () => {
        const res = await app.request('/api/admin/zones/TEST-TERR', { method: 'DELETE' });
        expect(res.status).toBe(200);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM restaurant_assignments WHERE employee_number LIKE 'TEST-%'`);
        await executeQuery(null, `DELETE FROM restaurant_tables      WHERE code LIKE 'TEST-%'`);
        await executeQuery(null, `DELETE FROM restaurant_zones       WHERE code LIKE 'TEST-%'`);
    });
});
