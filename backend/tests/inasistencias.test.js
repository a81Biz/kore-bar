// ============================================================
// inasistencias.test.js
// Módulo: Reporte de Inasistencias (Descuento Salarial)
// Códigos: INS-xx
//
// Flujo cubierto:
//   1. La vista vw_absence_deductions existe con columnas correctas
//   2. Solo incluye fechas pasadas sin check-in
//   3. GET /admin/attendance/absences devuelve datos y byArea
//   4. Filtros: employeeNumber, startDate/endDate, areaCode
//   5. Empleado con check-in NO aparece como ausente
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Admin — Inasistencias y Reporte de Descuentos', () => {

    const TEST_EMP_CAJERO  = 'INS-TEST-CAJ-01';
    const TEST_EMP_MESERO  = 'INS-TEST-MES-01';
    const PAST_DATE        = '2026-03-01';   // fecha pasada garantizada
    const PAST_DATE_2      = '2026-03-02';
    const TEST_ZONE        = 'INS-TEST-ZONE';

    beforeAll(async () => {
        // 1. Sincronizar catálogos para cajero (área 40) y mesero (área 20)
        await app.request('/api/admin/employees/sync-catalogs', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catalogo_puestos: [
                    { codigo_area: '40', nombre_area: 'Caja',  codigo_puesto: '10', nombre_puesto: 'Cajero Principal' },
                    { codigo_area: '20', nombre_area: 'Piso',  codigo_puesto: '04', nombre_puesto: 'Mesero General'   }
                ]
            })
        });

        // 2. Crear empleados via API
        await app.request('/api/admin/employees', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_CAJERO,
                firstName: 'Test', lastName: 'Cajero',
                areaId: '40', jobTitleId: '10', isActive: true
            })
        });
        await app.request('/api/admin/employees', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: TEST_EMP_MESERO,
                firstName: 'Test', lastName: 'Mesero',
                areaId: '20', jobTitleId: '04', isActive: true
            })
        });

        // 3. Horario pasado del cajero en employee_schedules (SCHEDULE source)
        await executeQuery(null, `
            INSERT INTO employee_schedules (employee_number, shift_code, schedule_date)
            VALUES ($1, 'MATUTINO', $2)
            ON CONFLICT (employee_number, schedule_date) DO NOTHING
        `, [TEST_EMP_CAJERO, PAST_DATE]);

        // 4. Zona + asignación pasada del mesero en restaurant_assignments (PISO source)
        await executeQuery(null, `
            INSERT INTO restaurant_zones (code, name)
            VALUES ($1, 'Zona INS Test') ON CONFLICT (code) DO NOTHING
        `, [TEST_ZONE]);

        await executeQuery(null, `
            INSERT INTO restaurant_assignments (employee_number, zone_id, shift, assignment_date)
            VALUES (
                $1,
                (SELECT id FROM restaurant_zones WHERE code = $2),
                'MATUTINO',
                $3
            )
            ON CONFLICT (employee_number, assignment_date) DO NOTHING
        `, [TEST_EMP_MESERO, TEST_ZONE, PAST_DATE]);

        // 5. Segunda ausencia del cajero para test de rango de fechas
        await executeQuery(null, `
            INSERT INTO employee_schedules (employee_number, shift_code, schedule_date)
            VALUES ($1, 'MATUTINO', $2)
            ON CONFLICT (employee_number, schedule_date) DO NOTHING
        `, [TEST_EMP_CAJERO, PAST_DATE_2]);
    });

    afterAll(async () => {
        await executeQuery(null, `
            DELETE FROM attendance_records WHERE employee_number IN ($1, $2)
        `, [TEST_EMP_CAJERO, TEST_EMP_MESERO]);
        await executeQuery(null, `
            DELETE FROM employee_schedules WHERE employee_number = $1
        `, [TEST_EMP_CAJERO]);
        await executeQuery(null, `
            DELETE FROM restaurant_assignments WHERE employee_number = $1
        `, [TEST_EMP_MESERO]);
        await executeQuery(null, `
            DELETE FROM restaurant_zones WHERE code = $1
        `, [TEST_ZONE]);
        await executeQuery(null, `
            DELETE FROM system_users WHERE employee_number IN ($1, $2)
        `, [TEST_EMP_CAJERO, TEST_EMP_MESERO]);
        await executeQuery(null, `
            DELETE FROM employees WHERE employee_number IN ($1, $2)
        `, [TEST_EMP_CAJERO, TEST_EMP_MESERO]);
    });


    // ═══════════════════════════════════════════════════════════
    // Vista vw_absence_deductions
    // ═══════════════════════════════════════════════════════════

    it('INS-01 La vista vw_absence_deductions existe en la BD', async () => {
        const check = await executeQuery(null, `
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
              AND table_name   = 'vw_absence_deductions'
        `);
        expect(check.length).toBe(1);
    });

    it('INS-02 La vista tiene las columnas clave: employee_number, absence_date, roster_source', async () => {
        const cols = await executeQuery(null, `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'vw_absence_deductions'
        `);
        const names = cols.map(c => c.column_name);
        expect(names).toContain('employee_number');
        expect(names).toContain('absence_date');
        expect(names).toContain('roster_source');
        expect(names).toContain('area_code');
        expect(names).toContain('shift_name');
    });

    it('INS-03 La vista nunca incluye fechas de hoy o futuras', async () => {
        const future = await executeQuery(null, `
            SELECT COUNT(*) AS cnt
            FROM vw_absence_deductions
            WHERE absence_date >= CURRENT_DATE
        `);
        expect(parseInt(future[0].cnt)).toBe(0);
    });

    it('INS-04 La vista solo incluye valores PISO o SCHEDULE en roster_source', async () => {
        const sources = await executeQuery(null, `
            SELECT DISTINCT roster_source FROM vw_absence_deductions LIMIT 20
        `);
        const valid = ['PISO', 'SCHEDULE'];
        sources.forEach(row => {
            expect(valid).toContain(row.roster_source);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // GET /admin/attendance/absences
    // ═══════════════════════════════════════════════════════════

    it('INS-05 GET /admin/attendance/absences responde 200', async () => {
        const res = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        expect(res.status).toBe(200);
    });

    it('INS-06 La respuesta tiene success=true y data con total, absences y byArea', async () => {
        const res  = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data).toHaveProperty('total');
        expect(json.data).toHaveProperty('absences');
        expect(json.data).toHaveProperty('byArea');
        expect(Array.isArray(json.data.absences)).toBe(true);
    });

    it('INS-07 El cajero de prueba aparece como SCHEDULE source en el listado', async () => {
        const res  = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const json = await res.json();
        const found = json.data.absences.find(a => a.employeeNumber === TEST_EMP_CAJERO);
        expect(found).toBeDefined();
        expect(found.rosterSource).toBe('SCHEDULE');
    });

    it('INS-08 El mesero de prueba aparece como PISO source en el listado', async () => {
        const res  = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const json = await res.json();
        const found = json.data.absences.find(a => a.employeeNumber === TEST_EMP_MESERO);
        expect(found).toBeDefined();
        expect(found.rosterSource).toBe('PISO');
    });

    it('INS-09 Los registros tienen los campos camelCase requeridos para nómina', async () => {
        const res    = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const json   = await res.json();
        const record = json.data.absences.find(a => a.employeeNumber === TEST_EMP_CAJERO);
        expect(record).toHaveProperty('employeeNumber');
        expect(record).toHaveProperty('firstName');
        expect(record).toHaveProperty('lastName');
        expect(record).toHaveProperty('areaName');
        expect(record).toHaveProperty('absenceDate');
        expect(record).toHaveProperty('shiftName');
        expect(record).toHaveProperty('rosterSource');
    });

    it('INS-10 byArea agrupa correctamente — Caja tiene al menos 1 ausencia', async () => {
        const res  = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const json = await res.json();
        expect(json.data.byArea['Caja']).toBeGreaterThanOrEqual(1);
    });

    it('INS-11 byArea agrupa correctamente — Piso tiene al menos 1 ausencia', async () => {
        const res  = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const json = await res.json();
        expect(json.data.byArea['Piso']).toBeGreaterThanOrEqual(1);
    });

    it('INS-12 total = longitud del array absences', async () => {
        const res  = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const json = await res.json();
        expect(json.data.total).toBe(json.data.absences.length);
    });


    // ═══════════════════════════════════════════════════════════
    // Filtros del endpoint
    // ═══════════════════════════════════════════════════════════

    it('INS-13 Filtra por employeeNumber y devuelve solo ese empleado', async () => {
        const res  = await app.request(
            `/api/admin/attendance/absences?employeeNumber=${TEST_EMP_CAJERO}`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(res.status).toBe(200);
        json.data.absences.forEach(a => {
            expect(a.employeeNumber).toBe(TEST_EMP_CAJERO);
        });
    });

    it('INS-14 Filtra por rango de fechas — startDate y endDate', async () => {
        const res  = await app.request(
            `/api/admin/attendance/absences?startDate=${PAST_DATE}&endDate=${PAST_DATE}`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(res.status).toBe(200);
        json.data.absences.forEach(a => {
            expect(a.absenceDate).toBe(PAST_DATE);
        });
    });

    it('INS-15 Filtra por areaCode=40 y devuelve solo empleados de Caja', async () => {
        const res  = await app.request(
            `/api/admin/attendance/absences?areaCode=40`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(res.status).toBe(200);
        json.data.absences.forEach(a => {
            expect(a.areaCode).toBe('40');
        });
    });

    it('INS-16 Rango de fechas futuros devuelve total=0', async () => {
        const res  = await app.request(
            `/api/admin/attendance/absences?startDate=2099-01-01&endDate=2099-12-31`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.data.total).toBe(0);
        expect(json.data.absences).toHaveLength(0);
    });

    it('INS-17 Combinación de filtros: employeeNumber + startDate + endDate', async () => {
        const res  = await app.request(
            `/api/admin/attendance/absences?employeeNumber=${TEST_EMP_CAJERO}&startDate=${PAST_DATE}&endDate=${PAST_DATE}`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(res.status).toBe(200);
        json.data.absences.forEach(a => {
            expect(a.employeeNumber).toBe(TEST_EMP_CAJERO);
            expect(a.absenceDate).toBe(PAST_DATE);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // Lógica de consolidación: check-in elimina la ausencia
    // ═══════════════════════════════════════════════════════════

    it('INS-18 Cajero con check-in registrado NO aparece en el reporte ese día', async () => {
        // Registrar check-in para el cajero en PAST_DATE
        await executeQuery(null, `
            INSERT INTO attendance_records (employee_number, source, work_date)
            VALUES ($1, 'CASHIER', $2)
            ON CONFLICT (employee_number, work_date) DO NOTHING
        `, [TEST_EMP_CAJERO, PAST_DATE]);

        const res  = await app.request(
            `/api/admin/attendance/absences?employeeNumber=${TEST_EMP_CAJERO}&startDate=${PAST_DATE}&endDate=${PAST_DATE}`,
            { method: 'GET' }
        );
        const json = await res.json();

        // Con check-in en PAST_DATE, NO debe aparecer ese día
        const found = json.data.absences.find(
            a => a.employeeNumber === TEST_EMP_CAJERO && a.absenceDate === PAST_DATE
        );
        expect(found).toBeUndefined();

        // Limpiar check-in para no afectar test INS-19
        await executeQuery(null, `
            DELETE FROM attendance_records
            WHERE employee_number = $1 AND work_date = $2
        `, [TEST_EMP_CAJERO, PAST_DATE]);
    });

    it('INS-19 Cajero sin check-in en PAST_DATE_2 sigue apareciendo como ausente', async () => {
        const res  = await app.request(
            `/api/admin/attendance/absences?employeeNumber=${TEST_EMP_CAJERO}&startDate=${PAST_DATE_2}&endDate=${PAST_DATE_2}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const found = json.data.absences.find(
            a => a.employeeNumber === TEST_EMP_CAJERO && a.absenceDate === PAST_DATE_2
        );
        expect(found).toBeDefined();
        expect(found.rosterSource).toBe('SCHEDULE');
    });

    it('INS-20 El total en byArea decrece al registrar check-in del cajero', async () => {
        const resBefore = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const before    = (await resBefore.json()).data.byArea['Caja'] || 0;

        // Registrar check-ins para los dos días del cajero
        await executeQuery(null, `
            INSERT INTO attendance_records (employee_number, source, work_date)
            VALUES ($1, 'CASHIER', $2), ($1, 'CASHIER', $3)
            ON CONFLICT (employee_number, work_date) DO NOTHING
        `, [TEST_EMP_CAJERO, PAST_DATE, PAST_DATE_2]);

        const resAfter = await app.request('/api/admin/attendance/absences', { method: 'GET' });
        const after    = (await resAfter.json()).data.byArea['Caja'] || 0;

        expect(after).toBeLessThan(before);

        // Limpiar check-ins
        await executeQuery(null, `
            DELETE FROM attendance_records WHERE employee_number = $1
        `, [TEST_EMP_CAJERO]);
    });
});
