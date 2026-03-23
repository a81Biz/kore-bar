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
// Filtra por fecha exacta o rango (startDate/endDate).
// employeeNumber es opcional.

export const getAttendance = async (c, { date, startDate, endDate, employeeNumber } = {}) => {
    const conditions = [];
    const params = [];

    // Rango de fechas: si hay startDate/endDate los prioriza; si no, usa date (default hoy)
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
        SELECT  assignment_id,
                employee_number  AS "employeeNumber",
                first_name       AS "firstName",
                last_name        AS "lastName",
                shift,
                shift_name       AS "shiftName",
                start_time       AS "startTime",
                end_time         AS "endTime",
                assignment_date  AS "assignmentDate",
                zone_name        AS "zoneName",
                zone_code        AS "zoneCode",
                attendance_id    AS "attendanceId",
                check_in_at      AS "checkInAt",
                source,
                attendance_status AS "attendanceStatus"
        FROM    vw_attendance_monitor
        ${where}
        ORDER BY assignment_date DESC, shift, last_name ASC
    `, params);
};

// ── RESET DE PIN ──────────────────────────────────────────────

export const resetPin = async (c, employeeNumber, newPin) =>
    await executeStoredProcedure(c, 'sp_reset_employee_pin', {
        p_employee_number: employeeNumber,
        p_new_pin: newPin
    });

// ── REGISTRO DE ASISTENCIA (llamado por waiter y cashier helpers) ─
// Idempotente: ON CONFLICT DO NOTHING en el SP.
// El llamador envuelve en try/catch y solo loga el warning — no falla el login.

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

// Misma firma que getAttendance para consistencia en el helper.
// Lee desde vw_schedule_monitor (misma estructura de columnas).
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

// ── ALIAS: el helper llama createEmployeeSchedule ─────────────
// El SP se llama sp_create_employee_schedule (sin _range).
// Este alias evita tener que cambiar el helper ya existente.
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
// Consulta vw_absence_deductions (definida en 10_faltantes.sql).
// Soporta filtros opcionales: startDate, endDate, employeeNumber, areaCode.
// Todos los alias de columna están en camelCase para el helper.

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

    const where = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    return await executeQuery(c, `
        SELECT
            employee_number                            AS "employeeNumber",
            first_name                                 AS "firstName",
            last_name                                  AS "lastName",
            area_code                                  AS "areaCode",
            area_name                                  AS "areaName",
            TO_CHAR(absence_date, 'YYYY-MM-DD')        AS "absenceDate",
            shift_name                                 AS "shiftName",
            TO_CHAR(start_time, 'HH24:MI:SS')          AS "startTime",
            TO_CHAR(end_time,   'HH24:MI:SS')          AS "endTime",
            roster_source                              AS "rosterSource"
        FROM   vw_absence_deductions
        ${where}
        ORDER BY absence_date DESC, area_name, last_name
    `, params);
};