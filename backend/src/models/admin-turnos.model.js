// src/models/admin-turnos.model.js
import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── CATÁLOGO DE TURNOS ────────────────────────────────────────

export const getShifts = async (c) =>
    await executeQuery(c, `
        SELECT  code,
                name,
                start_time  AS "startTime",
                end_time    AS "endTime",
                is_active   AS "isActive"
        FROM    shift_catalog
        WHERE   is_active = true
        ORDER BY start_time ASC
    `);

export const createShift = async (c, code, name, startTime, endTime) =>
    await executeStoredProcedure(c, 'sp_create_shift', {
        p_code: code,
        p_name: name,
        p_start_time: startTime,
        p_end_time: endTime
    });

// ── MONITOR DE ASISTENCIA ─────────────────────────────────────
// FIX: UNION de ambas fuentes de roster:
//   - vw_attendance_monitor  → restaurant_assignments (meseros de Piso)
//   - vw_schedule_monitor    → employee_schedules (cajeros, cocineros, staff)
//
// Ambas vistas exponen exactamente las mismas columnas, por lo que
// el UNION ALL funciona sin casteos adicionales.
// Se usa UNION ALL (no UNION) para evitar el DISTINCT implícito
// que sería costoso y no necesario (los IDs son distintos por fuente).

export const getAttendance = async (c, { date, startDate, endDate, employeeNumber } = {}) => {
    let pDate = null, pStartDate = null, pEndDate = null, pEmployeeNumber = employeeNumber || null;

    if (startDate && endDate) {
        pStartDate = startDate;
        pEndDate = endDate;
    } else {
        pDate = date || new Date().toISOString().split('T')[0];
    }

    return await executeQuery(c, `
        SELECT * FROM sp_get_attendance(
            $1::DATE, 
            $2::DATE, 
            $3::DATE, 
            $4::VARCHAR
        )
    `, [pDate, pStartDate, pEndDate, pEmployeeNumber]);
};

// ── RESET DE PIN ──────────────────────────────────────────────

export const resetPin = async (c, employeeNumber, newPin) =>
    await executeStoredProcedure(c, 'sp_reset_employee_pin', {
        p_employee_number: employeeNumber,
        p_new_pin: newPin
    });

// ── REGISTRO DE ASISTENCIA ────────────────────────────────────

export const recordAttendance = async (c, employeeNumber, source) =>
    await executeStoredProcedure(c, 'sp_record_attendance', {
        p_employee_number: employeeNumber,
        p_source: source
    });

// ── MÓDULO HORARIOS (employee_schedules) ──────────────────────

export const deleteEmployeeSchedule = async (c, id) =>
    await executeStoredProcedure(c, 'sp_delete_employee_schedule', {
        p_id: id
    }, { p_id: 'UUID' });

export const getSchedules = async (c, { date, startDate, endDate, employeeNumber } = {}) => {
    const conditions = [];
    const params = [];

    if (startDate && endDate) {
        params.push(startDate);
        conditions.push(`assignment_date >= $${params.length}`);
        params.push(endDate);
        conditions.push(`assignment_date <= $${params.length}`);
    } else {
        params.push(date || new Date().toISOString().split('T')[0]);
        conditions.push(`assignment_date = $${params.length}`);
    }

    if (employeeNumber) {
        params.push(employeeNumber);
        conditions.push(`employee_number = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return await executeQuery(c, `
        SELECT  assignment_id       AS "assignmentId",
                employee_number     AS "employeeNumber",
                first_name          AS "firstName",
                last_name           AS "lastName",
                shift,
                shift_name          AS "shiftName",
                start_time          AS "startTime",
                end_time            AS "endTime",
                assignment_date     AS "assignmentDate",
                zone_name           AS "zoneName",
                zone_code           AS "zoneCode",
                attendance_id       AS "attendanceId",
                check_in_at         AS "checkInAt",
                source,
                attendance_status   AS "attendanceStatus"
        FROM    vw_schedule_monitor
        ${where}
        ORDER BY assignment_date DESC, shift, last_name ASC
    `, params);
};

export const createEmployeeSchedule = async (c, employeeNumber, shiftCode, startDate, endDate) =>
    await executeStoredProcedure(
        c,
        'sp_create_employee_schedule',
        {
            p_employee_number: employeeNumber,
            p_shift_code: shiftCode,
            p_start_date: startDate,
            p_end_date: endDate
        },
        { p_start_date: 'DATE', p_end_date: 'DATE' }
    );

// ── INASISTENCIAS ─────────────────────────────────────────────

export const getAbsences = async (c, { startDate, endDate, employeeNumber, areaCode } = {}) => {
    const conditions = [];
    const params = [];

    if (startDate) {
        params.push(startDate);
        conditions.push(`absence_date >= $${params.length}`);
    }
    if (endDate) {
        params.push(endDate);
        conditions.push(`absence_date <= $${params.length}`);
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
            employee_number                       AS "employeeNumber",
            first_name                            AS "firstName",
            last_name                             AS "lastName",
            area_code                             AS "areaCode",
            area_name                             AS "areaName",
            TO_CHAR(absence_date, 'YYYY-MM-DD')   AS "absenceDate",
            shift_name                            AS "shiftName",
            TO_CHAR(start_time, 'HH24:MI:SS')     AS "startTime",
            TO_CHAR(end_time,   'HH24:MI:SS')     AS "endTime",
            roster_source                         AS "rosterSource"
        FROM   vw_absence_deductions
        ${where}
        ORDER BY absence_date DESC, area_name, last_name
    `, params);
};