// src/models/admin-payroll.model.js
import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── GET /attendance/payroll ───────────────────────────────────
// Devuelve filas de vw_payroll_history filtradas por rango y opcionales.
// El helper agrupa por empleado.
export const getPayrollHistory = async (c, { startDate, endDate, employeeNumber, areaCode } = {}) => {
    const conditions = [];
    const params = [];

    if (startDate) {
        params.push(startDate);
        conditions.push(`work_date >= $${params.length}`);
    }
    if (endDate) {
        params.push(endDate);
        conditions.push(`work_date <= $${params.length}`);
    }
    if (employeeNumber) {
        params.push(employeeNumber);
        conditions.push(`employee_number = $${params.length}`);
    }
    if (areaCode) {
        params.push(areaCode);
        conditions.push(`area_code = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return await executeQuery(c, `
        SELECT
            employee_number     AS "employeeNumber",
            first_name          AS "firstName",
            last_name           AS "lastName",
            area_code           AS "areaCode",
            area_name           AS "areaName",
            job_title_name      AS "jobTitle",
            TO_CHAR(work_date, 'YYYY-MM-DD')           AS "workDate",
            shift_name          AS "shiftName",
            TO_CHAR(start_time, 'HH24:MI')             AS "startTime",
            TO_CHAR(end_time,   'HH24:MI')             AS "endTime",
            check_in_at,
            checkin_source      AS "checkinSource",
            worked_day          AS "workedDay",
            has_deduction       AS "hasDeduction",
            deduction_id        AS "deductionId",
            deduction_type      AS "deductionType",
            motivo,
            applied_by          AS "appliedBy",
            pay_day             AS "payDay",
            roster_source       AS "rosterSource"
        FROM vw_payroll_history
        ${where}
        ORDER BY employee_number, work_date ASC
    `, params);
};


// ── POST /attendance/deductions ───────────────────────────────
export const createDeduction = async (c, employeeNumber, deductionDate, deductionType, motivo, appliedBy) =>
    await executeStoredProcedure(c, 'sp_create_payroll_deduction', {
        p_employee_number: employeeNumber,
        p_deduction_date:  deductionDate,
        p_deduction_type:  deductionType,
        p_motivo:          motivo,
        p_applied_by:      appliedBy
    }, { p_deduction_date: 'DATE' });


// ── DELETE /attendance/deductions/:id ─────────────────────────
export const deleteDeduction = async (c, id) =>
    await executeStoredProcedure(c, 'sp_delete_payroll_deduction', {
        p_id: id
    }, { p_id: 'UUID' });


// ── GET /attendance/payroll/export ────────────────────────────
// Devuelve una fila por empleado con totales para CSV/JSON.
export const getPayrollExport = async (c, { startDate, endDate } = {}) => {
    const conditions = ['work_date IS NOT NULL'];
    const params = [];

    if (startDate) {
        params.push(startDate);
        conditions.push(`work_date >= $${params.length}`);
    }
    if (endDate) {
        params.push(endDate);
        conditions.push(`work_date <= $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    return await executeQuery(c, `
        SELECT
            employee_number             AS "employeeNumber",
            first_name                  AS "firstName",
            last_name                   AS "lastName",
            area_name                   AS "areaName",
            job_title_name              AS "jobTitle",
            COUNT(*)                    AS "totalDays",
            COUNT(*) FILTER (WHERE worked_day = true)      AS "daysWorked",
            COUNT(*) FILTER (WHERE worked_day = false
                AND has_deduction = false)                  AS "absences",
            COUNT(*) FILTER (WHERE pay_day = true)         AS "payableDays",
            COUNT(*) FILTER (WHERE has_deduction = true)   AS "deductions",
            -- Desglose de descuentos
            COUNT(*) FILTER (WHERE deduction_type = 'FALTA_INJUSTIFICADA')  AS "deductFalta",
            COUNT(*) FILTER (WHERE deduction_type = 'RETARDO')              AS "deductRetardo",
            COUNT(*) FILTER (WHERE deduction_type = 'PERMISO_SIN_GOCE')     AS "deductPermiso",
            COUNT(*) FILTER (WHERE deduction_type = 'DIA_ECONOMICO')        AS "deductEconomico",
            COUNT(*) FILTER (WHERE deduction_type = 'SUSPENSION')           AS "deductSuspension",
            COUNT(*) FILTER (WHERE deduction_type = 'SANCION')              AS "deductSancion"
        FROM vw_payroll_history
        ${where}
        GROUP BY employee_number, first_name, last_name, area_name, job_title_name
        ORDER BY area_name, last_name, first_name
    `, params);
};
