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