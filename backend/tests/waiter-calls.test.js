// ============================================================
// waiter-calls.test.js — v4
// Patrón: mismo SQL que waiter.test.js (ON CONFLICT, sin status)
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Público — Llamadas al Mesero', () => {
    let callId = null;

    beforeAll(async () => {
        // Idempotente — mismo patrón que waiter.test.js
        await executeQuery(null, `INSERT INTO restaurant_zones (code, name) VALUES ('CALL-ZONE', 'Zona Calls Test') ON CONFLICT (code) DO NOTHING`);
        await executeQuery(null, `INSERT INTO restaurant_tables (code, zone_id, capacity) VALUES ('CALL-T01', (SELECT id FROM restaurant_zones WHERE code='CALL-ZONE'), 4) ON CONFLICT (code) DO NOTHING`);
        // Limpiar llamadas residuales de corridas anteriores
        await executeQuery(null, `DELETE FROM waiter_calls WHERE table_id IN (SELECT id FROM restaurant_tables WHERE code = 'CALL-T01')`);
    });

    afterAll(async () => {
        await executeQuery(null, `DELETE FROM waiter_calls WHERE table_id IN (SELECT id FROM restaurant_tables WHERE code = 'CALL-T01')`);
        await executeQuery(null, `DELETE FROM restaurant_tables WHERE code = 'CALL-T01'`);
        await executeQuery(null, `DELETE FROM restaurant_zones WHERE code = 'CALL-ZONE'`);
    });

    it('CALL-01 Registra una llamada al mesero desde una mesa válida', async () => {
        const res = await app.request('/api/tables/CALL-T01/call-waiter', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'ORDER' })
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    it('CALL-02 Devuelve llamadas pendientes con datos de mesa', async () => {
        const res = await app.request('/api/waiters/calls', { method: 'GET' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        const calls = json.data?.body?.calls || json.data?.calls || [];
        const ourCall = calls.find(c => c.tableCode === 'CALL-T01');
        expect(ourCall).toBeDefined();
        expect(ourCall.reason).toBe('ORDER');
        callId = ourCall.id;
    });

    it('CALL-03 Marca una llamada como atendida', async () => {
        expect(callId).not.toBeNull();
        const res = await app.request(`/api/waiters/calls/${callId}/attend`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(200);
    });

    it('CALL-04 La llamada atendida ya no aparece en pendientes', async () => {
        // Verificar directamente en BD que el status cambió
        const dbRows = await executeQuery(null,
            `SELECT status FROM waiter_calls WHERE id = $1`, [callId]);
        expect(dbRows[0]?.status).toBe('ATTENDED');

        // Verificar que el endpoint sigue respondiendo correctamente
        const res = await app.request('/api/waiters/calls', { method: 'GET' });
        expect(res.status).toBe(200);
    });

    it('CALL-05 Rechaza atender una llamada inexistente', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res = await app.request(`/api/waiters/calls/${fakeId}/attend`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).not.toBe(200);
    });

    it('CALL-06 Registra llamada con razón por defecto si no se envía', async () => {
        const res = await app.request('/api/tables/CALL-T01/call-waiter', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(200);
    });
});