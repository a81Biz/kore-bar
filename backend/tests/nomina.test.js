// ============================================================
// nomina.test.js
// Módulo: Nómina, Check-in Admin y Acceso a Caja
//
// Prerequisito: ejecutar 11_payroll_FIXED.sql antes de correr.
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { executeQuery } from '../src/db/connection.js';

describe('Módulo Nómina — Check-in, Áreas, Historial y Descuentos', () => {

    const EMP_CAJERO = 'NOM-TEST-CAJ-01';
    const EMP_COCINERO = 'NOM-TEST-COC-01';
    const EMP_MESERO = 'NOM-TEST-MES-01';
    const AREA_CAJA = 'NOM-CAJA';
    const AREA_COCINA = 'NOM-COCINA';
    const AREA_PISO = 'NOM-PISO';
    const PUESTO_CAJ = 'NOM-P-CAJ';
    const PUESTO_COC = 'NOM-P-COC';
    const PUESTO_MES = 'NOM-P-MES';
    const ZONE_CODE = 'NOM-ZONE-01';
    const TODAY = new Date().toISOString().split('T')[0];
    const PAST_DATE = '2026-02-10';
    const PAST_DATE_2 = '2026-02-11';
    const PAST_DATE_3 = '2026-02-12';

    let deductionId = null;

    // ── beforeAll ─────────────────────────────────────────────
    beforeAll(async () => {
        // 1. Catálogos
        await app.request('/api/admin/employees/sync-catalogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catalogo_puestos: [
                    { codigo_area: AREA_CAJA, nombre_area: 'Caja Test', codigo_puesto: PUESTO_CAJ, nombre_puesto: 'Cajero NOM' },
                    { codigo_area: AREA_COCINA, nombre_area: 'Cocina Test', codigo_puesto: PUESTO_COC, nombre_puesto: 'Cocinero NOM' },
                    { codigo_area: AREA_PISO, nombre_area: 'Piso Test', codigo_puesto: PUESTO_MES, nombre_puesto: 'Mesero NOM' }
                ]
            })
        });

        // 2. Empleados
        for (const [num, area, puesto, fn, ln] of [
            [EMP_CAJERO, AREA_CAJA, PUESTO_CAJ, 'Test', 'Cajero'],
            [EMP_COCINERO, AREA_COCINA, PUESTO_COC, 'Test', 'Cocinero'],
            [EMP_MESERO, AREA_PISO, PUESTO_MES, 'Test', 'Mesero']
        ]) {
            await app.request('/api/admin/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeNumber: num, firstName: fn, lastName: ln,
                    areaId: area, jobTitleId: puesto, isActive: true
                })
            });
        }

        // 3. Turno
        await app.request('/api/admin/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'NOM-TURN', name: 'Turno NOM Test',
                startTime: '08:00', endTime: '16:00'
            })
        });

        // 4. Zona para mesero
        await app.request('/api/admin/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneCode: ZONE_CODE, name: 'Zona NOM Test' })
        });

        // 5. Horarios pasados del cajero (3 días)
        for (const d of [PAST_DATE, PAST_DATE_2, PAST_DATE_3]) {
            await app.request('/api/admin/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeNumber: EMP_CAJERO, shiftCode: 'NOM-TURN',
                    scheduleDate: d, recurrence: 'DIA'
                })
            });
        }

        // 6. Horario de hoy del cajero (para check-in manual CHK-03..05)
        await app.request('/api/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_CAJERO, shiftCode: 'NOM-TURN',
                scheduleDate: TODAY, recurrence: 'DIA'
            })
        });

        // 7. Asignación de piso de hoy del mesero (para CHK-06)
        await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_MESERO, zoneCode: ZONE_CODE,
                shift: 'MATUTINO', assignmentDate: TODAY, recurrence: 'DIA'
            })
        });

        // 8. Asignación pasada del mesero (para PAY historial Piso)
        await app.request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_MESERO, zoneCode: ZONE_CODE,
                shift: 'MATUTINO', assignmentDate: PAST_DATE, recurrence: 'DIA'
            })
        });

        // 9. Check-in retroactivo del cajero en PAST_DATE.
        //    Insertamos directo: sp_record_attendance usa CURRENT_DATE,
        //    no acepta fecha pasada. Usamos source='ADMIN' (habilitado en 11_payroll_FIXED.sql).
        await executeQuery(null, `
            INSERT INTO attendance_records (employee_number, source, work_date)
            VALUES ($1, 'ADMIN', $2)
            ON CONFLICT (employee_number, work_date) DO NOTHING
        `, [EMP_CAJERO, PAST_DATE]);
        // PAST_DATE_2 y PAST_DATE_3 sin check-in → quedan como ausencias
    });

    // ── afterAll ──────────────────────────────────────────────
    afterAll(async () => {
        await executeQuery(null, `DELETE FROM payroll_deductions WHERE employee_number IN ($1,$2,$3)`, [EMP_CAJERO, EMP_COCINERO, EMP_MESERO]);
        await executeQuery(null, `DELETE FROM attendance_records WHERE employee_number IN ($1,$2,$3)`, [EMP_CAJERO, EMP_COCINERO, EMP_MESERO]);
        await executeQuery(null, `DELETE FROM employee_schedules WHERE employee_number IN ($1,$2,$3)`, [EMP_CAJERO, EMP_COCINERO, EMP_MESERO]);
        await executeQuery(null, `DELETE FROM restaurant_assignments WHERE employee_number IN ($1,$2,$3)`, [EMP_CAJERO, EMP_COCINERO, EMP_MESERO]);
        await executeQuery(null, `DELETE FROM restaurant_zones WHERE code = $1`, [ZONE_CODE]);
        await executeQuery(null, `DELETE FROM shift_catalog WHERE code = 'NOM-TURN'`);
        await executeQuery(null, `DELETE FROM system_users WHERE employee_number IN ($1,$2,$3)`, [EMP_CAJERO, EMP_COCINERO, EMP_MESERO]);
        await executeQuery(null, `DELETE FROM employees WHERE employee_number IN ($1,$2,$3)`, [EMP_CAJERO, EMP_COCINERO, EMP_MESERO]);
    });


    // ════════════════════════════════════════════════════════
    // CHK — Check-in manual desde Admin
    // ════════════════════════════════════════════════════════

    it('CHK-01 La tabla payroll_deductions existe en la BD', async () => {
        const rows = await executeQuery(null, `
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'payroll_deductions'
        `);
        expect(rows.length).toBe(1);
    });

    it('CHK-02 El CHECK de attendance_records.source incluye ADMIN', async () => {
        const rows = await executeQuery(null, `
            SELECT pg_get_constraintdef(oid) AS def
            FROM pg_constraint
            WHERE conrelid = 'attendance_records'::regclass
              AND conname LIKE '%source%'
        `);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].def).toContain('ADMIN');
    });

    it('CHK-03 POST /admin/attendance/checkin con cajero asignado hoy → 200', async () => {
        const res = await app.request('/api/admin/attendance/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: EMP_CAJERO })
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    it('CHK-04 El check-in queda en BD con source=ADMIN para fecha de hoy', async () => {
        const rows = await executeQuery(null, `
            SELECT source FROM attendance_records
            WHERE employee_number = $1 AND work_date = $2
        `, [EMP_CAJERO, TODAY]);
        expect(rows.length).toBe(1);
        expect(rows[0].source).toBe('ADMIN');
    });

    it('CHK-05 Es idempotente: segunda llamada no duplica el registro', async () => {
        await app.request('/api/admin/attendance/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: EMP_CAJERO })
        });
        const rows = await executeQuery(null, `
            SELECT COUNT(*) AS cnt FROM attendance_records
            WHERE employee_number = $1 AND work_date = $2
        `, [EMP_CAJERO, TODAY]);
        expect(parseInt(rows[0].cnt)).toBe(1);
    });

    it('CHK-06 POST con mesero asignado hoy vía PISO → 200', async () => {
        const res = await app.request('/api/admin/attendance/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: EMP_MESERO })
        });
        expect(res.status).toBe(200);
    });

    it('CHK-07 POST sin asignación hoy (cocinero) → 404', async () => {
        const res = await app.request('/api/admin/attendance/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeNumber: EMP_COCINERO })
        });
        expect(res.status).toBe(404);
    });

    it('CHK-08 POST sin employeeNumber → 400', async () => {
        const res = await app.request('/api/admin/attendance/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(400);
    });


    // ════════════════════════════════════════════════════════
    // AREA — can_access_cashier en áreas
    // ════════════════════════════════════════════════════════

    it('AREA-01 La columna can_access_cashier existe en areas como boolean', async () => {
        const rows = await executeQuery(null, `
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'areas'
              AND column_name = 'can_access_cashier'
        `);
        expect(rows.length).toBe(1);
        expect(rows[0].data_type).toBe('boolean');
    });

    it('AREA-02 GET /admin/employees/areas incluye can_access_cashier', async () => {
        const res = await app.request('/api/admin/employees/areas', { method: 'GET' });
        const json = await res.json();
        expect(res.status).toBe(200);
        const areas = json.data?.areas || json.data || [];
        expect(Array.isArray(areas)).toBe(true);
        areas.forEach(a => expect(a).toHaveProperty('can_access_cashier'));
    });

    it('AREA-03 PUT /admin/employees/areas/:code con canAccessCashier=true → 200', async () => {
        const res = await app.request(`/api/admin/employees/areas/${AREA_CAJA}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaName: 'Caja Test', canAccessCashier: true })
        });
        expect(res.status).toBe(200);
    });

    it('AREA-04 Tras el PUT, can_access_cashier=true en BD', async () => {
        const rows = await executeQuery(null, `
            SELECT can_access_cashier FROM areas WHERE code = $1
        `, [AREA_CAJA]);
        expect(rows.length).toBe(1);
        expect(rows[0].can_access_cashier).toBe(true);
    });

    it('AREA-05 PUT con canAccessCashier=false actualiza a false en BD', async () => {
        await app.request(`/api/admin/employees/areas/${AREA_COCINA}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaName: 'Cocina Test', canAccessCashier: false })
        });
        const rows = await executeQuery(null, `
            SELECT can_access_cashier FROM areas WHERE code = $1
        `, [AREA_COCINA]);
        expect(rows[0].can_access_cashier).toBe(false);
    });

    it('AREA-06 PUT sin canAccessCashier preserva el valor actual (COALESCE en SP)', async () => {
        // Asegurar true primero
        await app.request(`/api/admin/employees/areas/${AREA_CAJA}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaName: 'Caja Test', canAccessCashier: true })
        });
        // PUT sin canAccessCashier
        await app.request(`/api/admin/employees/areas/${AREA_CAJA}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaName: 'Caja Renombrada' })
        });
        const rows = await executeQuery(null, `
            SELECT can_access_cashier FROM areas WHERE code = $1
        `, [AREA_CAJA]);
        expect(rows[0].can_access_cashier).toBe(true);
    });

    it('AREA-07 GET /cashier/employees no incluye empleados de áreas sin acceso a caja', async () => {
        const res = await app.request('/api/admin/cashier/employees', { method: 'GET' });
        expect(res.status).toBe(200);           // ← primero verificar status
        const json = await res.json();          // ← luego parsear
        const emps = json.data?.body?.employees || json.employees || [];
        const noAutorizado = emps.find(e => e.employeeNumber === EMP_COCINERO);
        expect(noAutorizado).toBeUndefined();
    });


    // ════════════════════════════════════════════════════════
    // PAY — Historial de nómina agrupado
    // ════════════════════════════════════════════════════════

    it('PAY-01 La vista vw_payroll_history existe en BD', async () => {
        const rows = await executeQuery(null, `
            SELECT table_name FROM information_schema.views
            WHERE table_schema = 'public' AND table_name = 'vw_payroll_history'
        `);
        expect(rows.length).toBe(1);
    });

    it('PAY-02 La vista tiene las columnas clave', async () => {
        const cols = await executeQuery(null, `
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vw_payroll_history'
        `);
        const names = cols.map(c => c.column_name);
        ['employee_number', 'work_date', 'worked_day', 'has_deduction', 'pay_day', 'roster_source']
            .forEach(c => expect(names).toContain(c));
    });

    it('PAY-03 GET /admin/attendance/payroll responde 200', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        expect(res.status).toBe(200);
    });

    it('PAY-04 La respuesta tiene employees (array) y summary', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.employees)).toBe(true);
        expect(json.data.summary).toHaveProperty('totals');
    });

    it('PAY-05 El cajero aparece en el historial del período', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        expect(emp).toBeDefined();
    });

    it('PAY-06 Cada empleado tiene summary con totalDays, daysWorked, payableDays, deductions', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        ['totalDays', 'daysWorked', 'payableDays', 'deductions']
            .forEach(k => expect(emp.summary).toHaveProperty(k));
    });

    it('PAY-07 El cajero tiene totalDays=3 para el rango de 3 fechas asignadas', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        expect(emp.summary.totalDays).toBe(3);
    });

    it('PAY-08 El cajero tiene daysWorked=1 (solo PAST_DATE tiene check-in)', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        expect(emp.summary.daysWorked).toBe(1);
    });

    it('PAY-09 Cada empleado tiene array days con workDate, workedDay, payDay, hasDeduction', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        expect(Array.isArray(emp.days)).toBe(true);
        expect(emp.days.length).toBe(3);
        ['workDate', 'workedDay', 'payDay', 'hasDeduction']
            .forEach(k => expect(emp.days[0]).toHaveProperty(k));
    });

    it('PAY-10 El día con check-in (PAST_DATE) tiene workedDay=true', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        const day = emp.days.find(d => d.workDate === PAST_DATE);
        expect(day?.workedDay).toBe(true);
    });

    it('PAY-11 Los días sin check-in (PAST_DATE_2, PAST_DATE_3) tienen workedDay=false', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        [PAST_DATE_2, PAST_DATE_3].forEach(d => {
            const day = emp.days.find(x => x.workDate === d);
            expect(day?.workedDay).toBe(false);
        });
    });

    it('PAY-12 El filtro ?employeeNumber devuelve solo ese empleado', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}&employeeNumber=${EMP_CAJERO}`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(json.data.employees.length).toBe(1);
        expect(json.data.employees[0].employeeNumber).toBe(EMP_CAJERO);
    });

    it('PAY-13 El mesero aparece con rosterSource=PISO en su día asignado', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_MESERO);
        expect(emp).toBeDefined();
        expect(emp.days[0].rosterSource).toBe('PISO');
    });


    // ════════════════════════════════════════════════════════
    // DED — Descuentos de nómina
    // ════════════════════════════════════════════════════════

    it('DED-01 POST /admin/attendance/deductions crea descuento FALTA_INJUSTIFICADA → 201', async () => {
        const res = await app.request('/api/admin/attendance/deductions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_CAJERO,
                deductionDate: PAST_DATE_2,
                deductionType: 'FALTA_INJUSTIFICADA',
                motivo: 'No se presentó sin avisar'
            })
        });
        expect(res.status).toBe(201);
        expect((await res.json()).success).toBe(true);
    });

    it('DED-02 El descuento queda en BD con tipo y motivo correctos', async () => {
        const rows = await executeQuery(null, `
            SELECT id, deduction_type, motivo FROM payroll_deductions
            WHERE employee_number = $1 AND deduction_date = $2
        `, [EMP_CAJERO, PAST_DATE_2]);
        expect(rows.length).toBe(1);
        expect(rows[0].deduction_type).toBe('FALTA_INJUSTIFICADA');
        deductionId = rows[0].id;
    });

    it('DED-03 El descuento aparece en PAY: hasDeduction=true y payDay=false (FALTA cancela día)', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}&employeeNumber=${EMP_CAJERO}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const day = json.data.employees
            .find(e => e.employeeNumber === EMP_CAJERO)
            ?.days.find(d => d.workDate === PAST_DATE_2);
        expect(day?.hasDeduction).toBe(true);
        expect(day?.payDay).toBe(false);
        expect(day?.deductionType).toBe('FALTA_INJUSTIFICADA');
    });

    it('DED-04 El summary refleja 1 descuento y payableDays=1', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}&employeeNumber=${EMP_CAJERO}`,
            { method: 'GET' }
        );
        const json = await res.json();
        const emp = json.data.employees.find(e => e.employeeNumber === EMP_CAJERO);
        expect(emp.summary.deductions).toBe(1);
        expect(emp.summary.payableDays).toBe(1);
    });

    it('DED-05 POST idempotente: mismo empleado/fecha actualiza tipo sin duplicar', async () => {
        await app.request('/api/admin/attendance/deductions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_CAJERO,
                deductionDate: PAST_DATE_2,
                deductionType: 'RETARDO',
                motivo: 'Llegó tarde — actualización'
            })
        });
        const rows = await executeQuery(null, `
            SELECT COUNT(*) AS cnt, deduction_type
            FROM payroll_deductions
            WHERE employee_number = $1 AND deduction_date = $2
            GROUP BY deduction_type
        `, [EMP_CAJERO, PAST_DATE_2]);
        expect(parseInt(rows[0].cnt)).toBe(1);
        expect(rows[0].deduction_type).toBe('RETARDO');
    });

    it('DED-06 RETARDO no cancela el día (payDay=true) cuando workedDay=true', async () => {
        // Poner RETARDO en PAST_DATE (día con check-in)
        await app.request('/api/admin/attendance/deductions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_CAJERO,
                deductionDate: PAST_DATE,
                deductionType: 'RETARDO',
                motivo: 'Llegó fuera de horario'
            })
        });
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}&employeeNumber=${EMP_CAJERO}`,
            { method: 'GET' }
        );
        const day = (await res.json()).data.employees
            .find(e => e.employeeNumber === EMP_CAJERO)
            ?.days.find(d => d.workDate === PAST_DATE);
        expect(day?.hasDeduction).toBe(true);
        expect(day?.payDay).toBe(true); // RETARDO no cancela pago

        // Limpiar para no contaminar EXP
        await executeQuery(null, `
            DELETE FROM payroll_deductions
            WHERE employee_number = $1 AND deduction_date = $2
        `, [EMP_CAJERO, PAST_DATE]);
    });

    it('DED-07 POST con tipo inválido → 400', async () => {
        const res = await app.request('/api/admin/attendance/deductions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_CAJERO, deductionDate: PAST_DATE_3,
                deductionType: 'TIPO_INVENTADO', motivo: 'Test'
            })
        });
        expect(res.status).toBe(400);
    });

    it('DED-08 POST sin motivo → 400 (campo requerido en schema)', async () => {
        const res = await app.request('/api/admin/attendance/deductions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: EMP_CAJERO, deductionDate: PAST_DATE_3,
                deductionType: 'FALTA_INJUSTIFICADA'
            })
        });
        expect(res.status).toBe(400);
    });

    it('DED-09 POST para empleado inexistente → 404', async () => {
        const res = await app.request('/api/admin/attendance/deductions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeNumber: 'EMP-FANTASMA-9999',
                deductionDate: PAST_DATE_2,
                deductionType: 'FALTA_INJUSTIFICADA',
                motivo: 'Test empleado inexistente'
            })
        });
        expect(res.status).toBe(404);
    });

    it('DED-10 DELETE /admin/attendance/deductions/:id → 200', async () => {
        expect(deductionId).toBeDefined();
        const res = await app.request(
            `/api/admin/attendance/deductions/${deductionId}`,
            { method: 'DELETE' }
        );
        expect(res.status).toBe(200);
        expect((await res.json()).success).toBe(true);
    });

    it('DED-11 Tras DELETE el descuento no existe en BD', async () => {
        const rows = await executeQuery(null, `
            SELECT COUNT(*) AS cnt FROM payroll_deductions WHERE id = $1
        `, [deductionId]);
        expect(parseInt(rows[0].cnt)).toBe(0);
    });

    it('DED-12 Tras DELETE el día vuelve a hasDeduction=false en historial', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}&employeeNumber=${EMP_CAJERO}`,
            { method: 'GET' }
        );
        const day = (await res.json()).data.employees
            .find(e => e.employeeNumber === EMP_CAJERO)
            ?.days.find(d => d.workDate === PAST_DATE_2);
        expect(day?.hasDeduction).toBe(false);
    });

    it('DED-13 DELETE con UUID inexistente → 404', async () => {
        const res = await app.request(
            '/api/admin/attendance/deductions/00000000-0000-0000-0000-000000000000',
            { method: 'DELETE' }
        );
        expect(res.status).toBe(404);
    });


    // ════════════════════════════════════════════════════════
    // EXP — Exportación de nómina
    // ════════════════════════════════════════════════════════

    it('EXP-01 GET /admin/attendance/payroll/export responde 200', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll/export?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        expect(res.status).toBe(200);
    });

    it('EXP-02 La respuesta tiene period, rows y totals', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll/export?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data).toHaveProperty('period');
        expect(Array.isArray(json.data.rows)).toBe(true);
        expect(json.data).toHaveProperty('totals');
    });

    it('EXP-03 Cada fila tiene todos los campos de nómina con desglose por tipo', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll/export?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const row = (await res.json()).data.rows.find(r => r.employeeNumber === EMP_CAJERO);
        expect(row).toBeDefined();
        [
            'employeeNumber', 'firstName', 'lastName', 'areaName', 'jobTitle',
            'totalDays', 'daysWorked', 'payableDays', 'deductions',
            'deductFalta', 'deductRetardo', 'deductPermiso',
            'deductEconomico', 'deductSuspension', 'deductSancion'
        ].forEach(f => expect(row).toHaveProperty(f));
    });

    it('EXP-04 totalDays del cajero es 3', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll/export?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const row = (await res.json()).data.rows.find(r => r.employeeNumber === EMP_CAJERO);
        expect(parseInt(row.totalDays)).toBe(3);
    });

    it('EXP-05 daysWorked del cajero es 1', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll/export?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const row = (await res.json()).data.rows.find(r => r.employeeNumber === EMP_CAJERO);
        expect(parseInt(row.daysWorked)).toBe(1);
    });

    it('EXP-06 totals.totalDays == suma de totalDays de cada fila', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll/export?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const { rows, totals } = (await res.json()).data;
        const suma = rows.reduce((s, r) => s + parseInt(r.totalDays || 0), 0);
        expect(totals.totalDays).toBe(suma);
    });

    it('EXP-07 GET sin startDate/endDate → 400', async () => {
        const res = await app.request('/api/admin/attendance/payroll/export', { method: 'GET' });
        expect(res.status).toBe(400);
    });

    it('EXP-08 El period refleja exactamente el rango solicitado', async () => {
        const res = await app.request(
            `/api/admin/attendance/payroll/export?startDate=${PAST_DATE}&endDate=${PAST_DATE_3}`,
            { method: 'GET' }
        );
        const { period } = (await res.json()).data;
        expect(period.startDate).toBe(PAST_DATE);
        expect(period.endDate).toBe(PAST_DATE_3);
    });

});