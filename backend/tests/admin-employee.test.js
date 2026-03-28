// ============================================================
// admin-employee.test.js
// Módulo: Administración de Empleados, Áreas y Puestos
// Códigos: EMP-xx | CAT-xx
// ============================================================
import { describe, it, expect, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Empleados y Catálogos', () => {
    let trackedEmployeeNums = [];

    // ── EMPLEADOS ─────────────────────────────────────────────

    it('EMP-01 Crea un empleado nuevo mediante sp_upsert_employee', async () => {
        const res = await app.request('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'TEST-001',
                firstName: 'Test',
                lastName: 'User',
                areaId: '20',
                jobTitleId: '04',
                isActive: true
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
    });

    it('EMP-02 Rechaza creación si faltan campos requeridos (Gatekeeper 400)', async () => {
        const res = await app.request('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: 'Incompleto' })
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    it('EMP-03 Devuelve el directorio completo de empleados', async () => {
        const res = await app.request('/api/admin/employees', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data)).toBe(true);

        if (json.data.length > 0) {
            expect(json.data[0]).toHaveProperty('employee_number');
            expect(json.data[0]).toHaveProperty('first_name');
            expect(json.data[0]).toHaveProperty('job_title_code');
        }
    });

    it('EMP-04 Actualiza un empleado existente exitosamente', async () => {
        const res = await app.request('/api/admin/employees/update/TEST-001', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: 'TestActualizado',
                lastName: 'User',
                areaId: '20',
                jobTitleId: '04',
                isActive: true
            })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT first_name FROM employees WHERE employee_number = 'TEST-001'`);
        expect(checkRes[0].first_name).toBe('TestActualizado');
    });

    it('EMP-05 Devuelve 404 al actualizar un empleado inexistente', async () => {
        const res = await app.request('/api/admin/employees/update/NO-EXISTO', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'No', lastName: 'Existo', areaId: '10', jobTitleId: '01', isActive: true })
        });

        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.success).toBe(false);
    });

    it('EMP-06 Da de baja lógica a un empleado', async () => {
        const res = await app.request('/api/admin/employees/TEST-001', { method: 'DELETE' });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT is_active FROM employees WHERE employee_number = 'TEST-001'`);
        expect(checkRes[0].is_active).toBe(false);
    });

    // ── BULK EMPLEADOS ────────────────────────────────────────

    it('EMP-07 Inserta múltiples empleados en una sola transacción', async () => {
        const res = await app.request('/api/admin/employees/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employees: [
                    { employeeNumber: 'BULK-001', firstName: 'Bulk1', lastName: 'A', areaId: '10', jobTitleId: '01', isActive: true },
                    { employeeNumber: 'BULK-002', firstName: 'Bulk2', lastName: 'B', areaId: '20', jobTitleId: '04', isActive: true }
                ]
            })
        });

        expect(res.status).toBe(200);
        trackedEmployeeNums.push('BULK-001', 'BULK-002');
    });

    // ── WEBHOOK RRHH ──────────────────────────────────────────

    it('EMP-08 Webhook acepta un empleado válido y lo crea', async () => {
        const res = await app.request('/api/admin/employees/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'alta',
                data: { numero_empleado: '88800011', nombre: 'Webhook', apellidos: 'User', codigo_area: '20', codigo_puesto: '04', fecha_llegada: '2026-03-06' }
            })
        });

        expect(res.status).toBe(200);
        trackedEmployeeNums.push('88800011');
    });

    it('EMP-09 Webhook rechaza si la posición no existe', async () => {
        const res = await app.request('/api/admin/employees/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'alta',
                data: { numero_empleado: '88800012', nombre: 'Fake', apellidos: 'User', codigo_area: '99', codigo_puesto: '99', fecha_llegada: '2026-03-06' }
            })
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.message || data.error).toContain('no existe');
    });

    it('EMP-10 Webhook rechaza si la fecha de ingreso es más antigua que la registrada', async () => {
        const res = await app.request('/api/admin/employees/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'alta',
                data: { numero_empleado: '88800011', nombre: 'Webhook', apellidos: 'User', codigo_area: '20', codigo_puesto: '04', fecha_llegada: '2000-01-01' }
            })
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('antiguo');
    });

    // ── SYNC CATÁLOGOS ────────────────────────────────────────

    it('EMP-11 Sincroniza catálogo de áreas y puestos desde RRHH', async () => {
        const res = await app.request('/api/admin/employees/sync-catalogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catalogo_puestos: [{
                    codigo_area: '99',
                    nombre_area: 'Mantenimiento Test',
                    codigo_puesto: '999',
                    nombre_puesto: 'Técnico de Pruebas'
                }]
            })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `
            SELECT jt.name AS job_name, a.name AS area_name
            FROM positions p
            JOIN job_titles jt ON p.job_title_id = jt.id
            JOIN areas a       ON p.area_id = a.id
            WHERE jt.code = '999' AND a.code = '99'
        `);
        expect(checkRes.length).toBe(1);
        expect(checkRes[0].job_name).toBe('Técnico de Pruebas');
        expect(checkRes[0].area_name).toBe('Mantenimiento Test');
    });

    // ── CATÁLOGO ÁREAS ────────────────────────────────────────

    it('CAT-01 Devuelve el catálogo de áreas activas', async () => {
        const res = await app.request('/api/admin/employees/areas', { method: 'GET' });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
        if (data.data.length > 0) {
            expect(data.data[0]).toHaveProperty('can_access_cashier');
        }
    });

    it('CAT-02 Crea un área nueva', async () => {
        const res = await app.request('/api/admin/employees/areas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: '98', areaName: 'Barra Nueva' })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT name FROM areas WHERE code = '98'`);
        expect(checkRes[0].name).toBe('Barra Nueva');
    });

    it('CAT-03 Actualiza el nombre de un área', async () => {
        const res = await app.request('/api/admin/employees/areas/99', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaName: 'Mantenimiento Modificado', isActive: true })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT name FROM areas WHERE code = '99'`);
        expect(checkRes[0].name).toBe('Mantenimiento Modificado');
    });

    it('CAT-04 Desactiva lógicamente un área', async () => {
        const res = await app.request('/api/admin/employees/areas/99', { method: 'DELETE' });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT is_active FROM areas WHERE code = '99'`);
        expect(checkRes[0].is_active).toBe(false);
    });

    it('CAT-05 Actualiza múltiples áreas en bulk', async () => {
        const res = await app.request('/api/admin/employees/areas/bulk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                areas: [
                    { code: '99', areaName: 'Bulk Área 99' },
                    { code: '98', areaName: 'Bulk Área 98' }
                ]
            })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT name FROM areas WHERE code IN ('99', '98') ORDER BY code`);
        expect(checkRes[0].name).toBe('Bulk Área 98');
        expect(checkRes[1].name).toBe('Bulk Área 99');
    });

    it('CAT-06 Desactiva múltiples áreas en bulk', async () => {
        const res = await app.request('/api/admin/employees/areas/bulk-deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes: ['99', '98'] })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT is_active FROM areas WHERE code IN ('99', '98')`);
        expect(checkRes.every(r => r.is_active === false)).toBe(true);
    });

    // ── CATÁLOGO PUESTOS ──────────────────────────────────────

    it('CAT-07 Devuelve el catálogo de puestos activos', async () => {
        const res = await app.request('/api/admin/employees/job-titles', { method: 'GET' });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
    });

    it('CAT-08 Crea un puesto nuevo', async () => {
        const res = await app.request('/api/admin/employees/job-titles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: '998', jobTitleName: 'Puesto Nuevo' })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT name FROM job_titles WHERE code = '998'`);
        expect(checkRes[0].name).toBe('Puesto Nuevo');
    });

    it('CAT-09 Actualiza el nombre de un puesto', async () => {
        const res = await app.request('/api/admin/employees/job-titles/999', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobTitleName: 'Técnico Modificado', isActive: true })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT name FROM job_titles WHERE code = '999'`);
        expect(checkRes[0].name).toBe('Técnico Modificado');
    });

    it('CAT-10 Desactiva lógicamente un puesto', async () => {
        const res = await app.request('/api/admin/employees/job-titles/999', { method: 'DELETE' });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT is_active FROM job_titles WHERE code = '999'`);
        expect(checkRes[0].is_active).toBe(false);
    });

    it('CAT-11 Actualiza múltiples puestos en bulk', async () => {
        const res = await app.request('/api/admin/employees/job-titles/bulk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobTitles: [
                    { code: '999', jobTitleName: 'Bulk Puesto 999' },
                    { code: '998', jobTitleName: 'Bulk Puesto 998' }
                ]
            })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT name FROM job_titles WHERE code IN ('999', '998') ORDER BY code`);
        expect(checkRes[0].name).toBe('Bulk Puesto 998');
        expect(checkRes[1].name).toBe('Bulk Puesto 999');
    });

    it('CAT-12 Desactiva múltiples puestos en bulk', async () => {
        const res = await app.request('/api/admin/employees/job-titles/bulk-deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes: ['999', '998'] })
        });

        expect(res.status).toBe(200);
        const checkRes = await executeQuery(null, `SELECT is_active FROM job_titles WHERE code IN ('999', '998')`);
        expect(checkRes.every(r => r.is_active === false)).toBe(true);
    });

    // ── TEARDOWN ──────────────────────────────────────────────
    afterAll(async () => {
        if (trackedEmployeeNums.length > 0) {
            const placeholders = trackedEmployeeNums.map((_, i) => `$${i + 1}`).join(',');
            await executeQuery(null, `DELETE FROM shifts       WHERE employee_id IN (SELECT id FROM employees WHERE employee_number IN (${placeholders}))`, trackedEmployeeNums);
            await executeQuery(null, `DELETE FROM system_users WHERE employee_number IN (${placeholders})`, trackedEmployeeNums);
            await executeQuery(null, `DELETE FROM employees    WHERE employee_number IN (${placeholders})`, trackedEmployeeNums);
        }
        await executeQuery(null, `DELETE FROM shifts    WHERE employee_id IN (SELECT id FROM employees WHERE position_id IN (SELECT id FROM positions WHERE code LIKE '99-%' OR code LIKE '98-%'))`);
        await executeQuery(null, `DELETE FROM employees WHERE position_id IN (SELECT id FROM positions WHERE code LIKE '99-%' OR code LIKE '98-%')`);
        await executeQuery(null, `DELETE FROM positions  WHERE code LIKE '99-%' OR code LIKE '98-%'`);
        await executeQuery(null, `DELETE FROM job_titles WHERE code IN ('999', '998')`);
        await executeQuery(null, `DELETE FROM areas      WHERE code IN ('99', '98')`);
    });
});
