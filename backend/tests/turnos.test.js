// ============================================================
// turnos.test.js
// Módulo: Gestión de Turnos y Asistencia
// Códigos: TUR-xx
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Turnos y Asistencia', () => {
    const TEST_SHIFT_CODE = 'TEST-NOCTURNO';
    const TEST_EMP_NUMBER = 'TUR-TEST-EMP-01';
    const TEST_PIN = '1234';

    // ── SETUP ─────────────────────────────────────────────────
    beforeAll(async () => {
        await app.request('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_NUMBER,
                firstName: 'Test',
                lastName: 'Turnos',
                areaId: '20',
                jobTitleId: '04',
                isActive: true
            })
        });

        await app.request(`/api/admin/employees/${TEST_EMP_NUMBER}/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: TEST_PIN })
        });
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM shift_catalog WHERE code = $1`, [TEST_SHIFT_CODE]);
        // employee_schedules y shifts tienen ON DELETE CASCADE desde employees
        await executeQuery(null, `DELETE FROM system_users WHERE employee_number = $1`, [TEST_EMP_NUMBER]);
        await executeQuery(null, `DELETE FROM employees WHERE employee_number = $1`, [TEST_EMP_NUMBER]);
    });

    // ══════════════════════════════════════════════════════════
    // CATÁLOGO DE TURNOS
    // ══════════════════════════════════════════════════════════

    it('TUR-01 Devuelve el catálogo de turnos activos', async () => {
        const res = await app.request('/api/admin/shifts');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.shifts)).toBe(true);

        const codes = json.data.shifts.map(s => s.code);
        expect(codes).toContain('MATUTINO');
        expect(codes).toContain('VESPERTINO');

        const shift = json.data.shifts[0];
        expect(shift).toHaveProperty('code');
        expect(shift).toHaveProperty('name');
        expect(shift).toHaveProperty('startTime');
        expect(shift).toHaveProperty('endTime');
    });

    it('TUR-02 Crea un nuevo turno en el catálogo', async () => {
        const res = await app.request('/api/admin/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: TEST_SHIFT_CODE,
                name: 'Turno Nocturno Test',
                startTime: '22:00',
                endTime: '06:00'
            })
        });
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.success).toBe(true);

        const rows = await executeQuery(null,
            `SELECT code FROM shift_catalog WHERE code = $1`,
            [TEST_SHIFT_CODE]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].code).toBe(TEST_SHIFT_CODE);
    });

    it('TUR-03 Rechaza duplicado de código de turno (400)', async () => {
        const res = await app.request('/api/admin/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: TEST_SHIFT_CODE,
                name: 'Duplicado',
                startTime: '22:00',
                endTime: '06:00'
            })
        });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.success).toBe(false);
    });

    it('TUR-04 Rechaza turno sin startTime (Gatekeeper 400)', async () => {
        const res = await app.request('/api/admin/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'SIN-HORA', name: 'Sin hora' })
        });
        expect(res.status).toBe(400);
    });

    // ══════════════════════════════════════════════════════════
    // MONITOR DE ASISTENCIA
    // ══════════════════════════════════════════════════════════

    it('TUR-05 Devuelve el monitor de asistencia de hoy', async () => {
        const today = new Date().toISOString().split('T')[0];
        const res = await app.request(`/api/admin/attendance?date=${today}`);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.records)).toBe(true);
        expect(json.data.stats).toHaveProperty('total');
        expect(json.data.stats).toHaveProperty('presente');
        expect(json.data.stats).toHaveProperty('esperado');
        expect(json.data.stats).toHaveProperty('ausente');
        expect(json.data.stats.total).toBeGreaterThanOrEqual(0);
    });

    it('TUR-06 stats.total = presente + esperado + ausente', async () => {
        const today = new Date().toISOString().split('T')[0];
        const res = await app.request(`/api/admin/attendance?date=${today}`);
        const json = await res.json();
        const s = json.data.stats;

        expect(s.presente + s.esperado + s.ausente).toBe(s.total);
    });

    it('TUR-07 Cada registro tiene attendanceStatus válido', async () => {
        const today = new Date().toISOString().split('T')[0];
        const res = await app.request(`/api/admin/attendance?date=${today}`);
        const json = await res.json();
        const valid = ['PRESENTE', 'ESPERADO', 'AUSENTE'];

        json.data.records.forEach(r => {
            expect(valid).toContain(r.attendanceStatus);
        });
    });

    it('TUR-08 Devuelve historial por rango de fechas', async () => {
        const res = await app.request(
            `/api/admin/attendance?startDate=2026-03-01&endDate=2026-03-31`
        );
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.records)).toBe(true);
    });

    // ══════════════════════════════════════════════════════════
    // RESET DE PIN
    // ══════════════════════════════════════════════════════════

    it('TUR-09 Resetea el PIN de un empleado activo', async () => {
        const NEW_PIN = '9999';

        const res = await app.request(`/api/admin/employees/${TEST_EMP_NUMBER}/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: NEW_PIN })
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);

        // Verificar que el PIN en BD es un hash bcrypt válido
        const rows = await executeQuery(null,
            `SELECT pin_code FROM employees WHERE employee_number = $1`,
            [TEST_EMP_NUMBER]
        );
        expect(rows[0].pin_code).toMatch(/^\$2[aby]\$/);
        const isValid = await bcrypt.compare(NEW_PIN, rows[0].pin_code);
        expect(isValid).toBe(true);

        // Restaurar
        await app.request(`/api/admin/employees/${TEST_EMP_NUMBER}/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: TEST_PIN })
        });
    });

    it('TUR-10 Rechaza PIN con menos de 4 dígitos (400)', async () => {
        const res = await app.request(`/api/admin/employees/${TEST_EMP_NUMBER}/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: '12' })
        });
        expect(res.status).toBe(400);
    });

    it('TUR-11 Rechaza PIN con caracteres no numéricos (400)', async () => {
        const res = await app.request(`/api/admin/employees/${TEST_EMP_NUMBER}/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: 'abcd' })
        });
        expect(res.status).toBe(400);
    });

    it('TUR-12 Rechaza reset-pin sin newPin (Gatekeeper 400)', async () => {
        const res = await app.request(`/api/admin/employees/${TEST_EMP_NUMBER}/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(400);
    });

    it('TUR-13 Devuelve 404 si el empleado no existe', async () => {
        const res = await app.request(`/api/admin/employees/NO-EXISTO/reset-pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: '1234' })
        });
        expect(res.status).toBe(404);
    });
});