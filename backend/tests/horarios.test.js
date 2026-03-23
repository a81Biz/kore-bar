// ============================================================
// backend/tests/admin-horarios.test.js
// Módulo: Horarios de Personal (cajeros, cocineros, staff no-piso)
// Códigos: HOR-xx
// ============================================================
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Horarios de Personal', () => {

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 29 * 86400000).toISOString().split('T')[0];

    const TEST_EMP_CAJERO = 'HOR-TEST-CAJ-01';
    const TEST_EMP_COCINERO = 'HOR-TEST-COC-01';
    const TEST_EMP_BARTEN = 'HOR-TEST-BAR-01';
    const SHIFT_CODE = 'MATUTINO';

    // ── SETUP ─────────────────────────────────────────────────
    // El SP de empleados valida que la posición (área + puesto) exista
    // en vw_dictionary_positions. Primero sincronizamos el catálogo con
    // sync-catalogs (idempotente), luego creamos los empleados de prueba.
    beforeAll(async () => {

        // 1. Crear áreas y puestos vía sync-catalogs (upsert idempotente)
        await app.request('/api/admin/employees/sync-catalogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catalogo_puestos: [
                    { codigo_area: '30', nombre_area: 'Cocina', codigo_puesto: '08', nombre_puesto: 'Cocinero A' },
                    { codigo_area: '40', nombre_area: 'Caja', codigo_puesto: '10', nombre_puesto: 'Cajero Principal' },
                    { codigo_area: '40', nombre_area: 'Caja', codigo_puesto: '11', nombre_puesto: 'Cajero Apoyo' }
                ]
            })
        });

        // 2. Crear empleados de prueba (sp_upsert_employee — idempotente)
        await app.request('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_CAJERO,
                firstName: 'Test',
                lastName: 'Cajero',
                areaId: '40',
                jobTitleId: '10',
                isActive: true
            })
        });

        await app.request('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_COCINERO,
                firstName: 'Test',
                lastName: 'Cocinero',
                areaId: '30',
                jobTitleId: '08',
                isActive: true
            })
        });

        await app.request('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_BARTEN,
                firstName: 'Test',
                lastName: 'Bartender',
                areaId: '40',
                jobTitleId: '11',
                isActive: true
            })
        });
    });

    // ═══════════════════════════════════════════════════════════
    // POST /admin/schedules — Crear horario
    // ═══════════════════════════════════════════════════════════

    it('HOR-01 Crea un horario para un día (recurrencia DIA)', async () => {
        const res = await app.request('/api/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_CAJERO,
                shiftCode: SHIFT_CODE,
                scheduleDate: today,
                recurrence: 'DIA'
            })
        });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.success).toBe(true);

        const check = await executeQuery(null, `
            SELECT COUNT(*) AS total
            FROM   employee_schedules
            WHERE  employee_number = $1
              AND  schedule_date   = $2
        `, [TEST_EMP_CAJERO, today]);
        expect(parseInt(check[0].total)).toBe(1);
    });

    it('HOR-02 Crea un horario semanal (recurrencia SEMANA) y genera 7 registros', async () => {
        const res = await app.request('/api/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_COCINERO,
                shiftCode: SHIFT_CODE,
                scheduleDate: today,
                recurrence: 'SEMANA'
            })
        });

        expect(res.status).toBe(201);

        const check = await executeQuery(null, `
            SELECT COUNT(*) AS total
            FROM   employee_schedules
            WHERE  employee_number = $1
              AND  schedule_date BETWEEN $2 AND $3
        `, [TEST_EMP_COCINERO, today, nextWeek]);
        expect(parseInt(check[0].total)).toBe(7);
    });

    it('HOR-03 La recurrencia MES genera exactamente 30 registros (hoy + 29)', async () => {
        const res = await app.request('/api/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_BARTEN,
                shiftCode: SHIFT_CODE,
                scheduleDate: today,
                recurrence: 'MES'
            })
        });

        expect(res.status).toBe(201);

        const check = await executeQuery(null, `
            SELECT COUNT(*) AS total
            FROM   employee_schedules
            WHERE  employee_number = $1
              AND  schedule_date BETWEEN $2 AND $3
        `, [TEST_EMP_BARTEN, today, nextMonth]);
        expect(parseInt(check[0].total)).toBe(30);
    });

    it('HOR-04 Rechaza si faltan campos requeridos — Gatekeeper 400', async () => {
        const res = await app.request('/api/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_CAJERO
                // falta shiftCode, scheduleDate y recurrence
            })
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
    });

    it('HOR-05 Rechaza si el empleado no existe (P0002 → 400)', async () => {
        const res = await app.request('/api/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'EMPLEADO-FANTASMA-99',
                shiftCode: SHIFT_CODE,
                scheduleDate: today,
                recurrence: 'DIA'
            })
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
    });

    it('HOR-06 Rechaza si el turno no existe (P0002 → 400)', async () => {
        const res = await app.request('/api/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_CAJERO,
                shiftCode: 'TURNO-INEXISTENTE',
                scheduleDate: tomorrow,
                recurrence: 'DIA'
            })
        });

        expect(res.status).toBe(400);
    });

    it('HOR-07 Es idempotente: crear el mismo horario dos veces no duplica ni falla', async () => {
        // El SP usa ON CONFLICT DO NOTHING — la segunda llamada devuelve 200 sin error
        const payload = {
            employeeNumber: TEST_EMP_CAJERO,
            shiftCode: SHIFT_CODE,
            scheduleDate: today,
            recurrence: 'DIA'
        };

        const res1 = await app.request('/api/admin/schedules', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const res2 = await app.request('/api/admin/schedules', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        expect(res1.status).toBe(201);
        expect(res2.status).toBe(201);

        const check = await executeQuery(null, `
            SELECT COUNT(*) AS total
            FROM   employee_schedules
            WHERE  employee_number = $1 AND schedule_date = $2
        `, [TEST_EMP_CAJERO, today]);
        expect(parseInt(check[0].total)).toBe(1);
    });

    // ═══════════════════════════════════════════════════════════
    // GET /admin/schedules — Consultar horarios
    // ═══════════════════════════════════════════════════════════

    it('HOR-08 Devuelve horarios del día de hoy con stats correctas', async () => {
        const res = await app.request(`/api/admin/schedules?date=${today}`, { method: 'GET' });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        const data = json.data;
        expect(Array.isArray(data.records)).toBe(true);
        expect(data.stats).toHaveProperty('total');
        expect(data.stats).toHaveProperty('presente');
        expect(data.stats).toHaveProperty('esperado');
        expect(data.stats).toHaveProperty('ausente');
        expect(data.stats.total).toBeGreaterThanOrEqual(2);
    });

    it('HOR-09 Los registros tienen la estructura camelCase esperada', async () => {
        const res = await app.request(`/api/admin/schedules?date=${today}`, { method: 'GET' });
        const json = await res.json();
        const record = json.data.records.find(r => r.employeeNumber === TEST_EMP_CAJERO);

        expect(record).toBeDefined();
        expect(record).toHaveProperty('employeeNumber');
        expect(record).toHaveProperty('firstName');
        expect(record).toHaveProperty('shiftName');
        expect(record).toHaveProperty('startTime');
        expect(record).toHaveProperty('endTime');
        expect(record).toHaveProperty('assignmentDate');
        expect(record).toHaveProperty('attendanceStatus');
    });

    it('HOR-10 Filtra correctamente por employeeNumber', async () => {
        const res = await app.request(
            `/api/admin/schedules?date=${today}&employeeNumber=${TEST_EMP_CAJERO}`,
            { method: 'GET' }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        const records = json.data.records;

        expect(records.every(r => r.employeeNumber === TEST_EMP_CAJERO)).toBe(true);
    });

    it('HOR-11 Filtra por rango de fechas (startDate + endDate)', async () => {
        const res = await app.request(
            `/api/admin/schedules?startDate=${today}&endDate=${nextWeek}`,
            { method: 'GET' }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.records.length).toBeGreaterThan(0);

        json.data.records.forEach(r => {
            const date = new Date(r.assignmentDate);
            expect(date >= new Date(today)).toBe(true);
            expect(date <= new Date(nextWeek + 'T23:59:59')).toBe(true);
        });
    });

    it('HOR-12 Devuelve records vacíos para una fecha sin horarios', async () => {
        const res = await app.request(`/api/admin/schedules?date=2099-12-31`, { method: 'GET' });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.records).toHaveLength(0);
        expect(json.data.stats.total).toBe(0);
    });

    it('HOR-13 El attendanceStatus es ESPERADO o AUSENTE para empleados sin check-in', async () => {
        const res = await app.request(`/api/admin/schedules?date=${today}`, { method: 'GET' });
        const json = await res.json();
        const record = json.data.records.find(r => r.employeeNumber === TEST_EMP_CAJERO);

        expect(record).toBeDefined();
        expect(['ESPERADO', 'AUSENTE']).toContain(record.attendanceStatus);
    });

    // ═══════════════════════════════════════════════════════════
    // DELETE /admin/schedules/:id — Eliminar horario individual
    // ═══════════════════════════════════════════════════════════

    it('HOR-14 Elimina un horario individual por UUID', async () => {
        const dbRecord = await executeQuery(null, `
            SELECT id FROM employee_schedules
            WHERE  employee_number = $1 AND schedule_date = $2
            LIMIT  1
        `, [TEST_EMP_CAJERO, today]);

        expect(dbRecord.length).toBeGreaterThan(0);
        const id = dbRecord[0].id;

        const res = await app.request(`/api/admin/schedules/${id}`, { method: 'DELETE' });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        const checkRes = await executeQuery(null, `
            SELECT id FROM employee_schedules WHERE id = $1
        `, [id]);
        expect(checkRes).toHaveLength(0);
    });

    it('HOR-15 Devuelve 404 al intentar eliminar un UUID inexistente', async () => {
        const fakeUUID = '00000000-0000-0000-0000-000000000000';
        const res = await app.request(`/api/admin/schedules/${fakeUUID}`, { method: 'DELETE' });

        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.success).toBe(false);
    });

    it('HOR-16 Eliminar un horario no afecta otros horarios del mismo empleado', async () => {
        // El cocinero tiene 7 registros del rango semanal (HOR-02)
        // Eliminamos solo el de hoy y verificamos que quedan 6
        const dbRecord = await executeQuery(null, `
            SELECT id FROM employee_schedules
            WHERE  employee_number = $1 AND schedule_date = $2
            LIMIT  1
        `, [TEST_EMP_COCINERO, today]);

        if (dbRecord.length > 0) {
            await app.request(`/api/admin/schedules/${dbRecord[0].id}`, { method: 'DELETE' });
        }

        const remaining = await executeQuery(null, `
            SELECT COUNT(*) AS total
            FROM   employee_schedules
            WHERE  employee_number = $1
        `, [TEST_EMP_COCINERO]);

        // Deben quedar 6 (7 originales - 1 eliminado)
        expect(parseInt(remaining[0].total)).toBe(6);
    });

    // ═══════════════════════════════════════════════════════════
    // TEARDOWN
    // ═══════════════════════════════════════════════════════════
    afterAll(async () => {
        const testEmployees = [TEST_EMP_CAJERO, TEST_EMP_COCINERO, TEST_EMP_BARTEN];
        const placeholders = testEmployees.map((_, i) => `$${i + 1}`).join(', ');

        await executeQuery(null,
            `DELETE FROM employee_schedules WHERE employee_number IN (${placeholders})`,
            testEmployees
        );
        await executeQuery(null,
            `DELETE FROM attendance_records WHERE employee_number IN (${placeholders})`,
            testEmployees
        );
        await executeQuery(null,
            `DELETE FROM system_users WHERE employee_number IN (${placeholders})`,
            testEmployees
        );
        await executeQuery(null,
            `DELETE FROM employees WHERE employee_number IN (${placeholders})`,
            testEmployees
        );
    });
});