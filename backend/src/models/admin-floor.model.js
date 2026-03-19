import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── ZONAS ────────────────────────────────────────────────────

export const createZone = async (c, code, name) =>
    await executeStoredProcedure(c, 'sp_create_zone', { p_code: code, p_name: name });

export const updateZone = async (c, code, name, isActive) =>
    await executeStoredProcedure(c, 'sp_update_zone', {
        p_code:      code,
        p_name:      name,
        p_is_active: isActive
    });

export const getActiveZones = async (c) =>
    await executeQuery(c, `
        SELECT code AS "zoneCode", name, is_active AS "isActive"
        FROM restaurant_zones
        ORDER BY created_at ASC
    `);

export const deleteZoneSmart = async (c, code) =>
    await executeStoredProcedure(c, 'sp_delete_zone_smart', { p_zone_code: code });


// ── MESAS ─────────────────────────────────────────────────────

export const createTable = async (c, code, zoneCode, capacity) =>
    await executeStoredProcedure(c, 'sp_create_table', {
        p_table_code: code,
        p_zone_code:  zoneCode,
        p_capacity:   capacity
    });

export const updateTable = async (c, code, zoneCode, capacity, isActive) =>
    await executeStoredProcedure(c, 'sp_update_table', {
        p_table_code: code,
        p_zone_code:  zoneCode,
        p_capacity:   capacity,
        p_is_active:  isActive
    });

export const getActiveTables = async (c) =>
    await executeQuery(c, `
        SELECT t.code AS "tableId", z.code AS "zoneCode", t.capacity, t.is_active AS "isActive"
        FROM restaurant_tables t
        JOIN restaurant_zones z ON t.zone_id = z.id
        ORDER BY t.code ASC
    `);

export const deleteTableSmart = async (c, id) =>
    await executeStoredProcedure(c, 'sp_delete_table_smart', { p_table_id: id });


// ── ASIGNACIONES OPERATIVAS ───────────────────────────────────

export const createAssignmentRange = async (c, empNum, zoneCode, shift, startDate, endDate) =>
    await executeStoredProcedure(
        c,
        'sp_create_assignment_range',
        {
            p_emp:        empNum,
            p_zone:       zoneCode,
            p_shift:      shift,
            p_start_date: startDate,
            p_end_date:   endDate
        },
        { p_start_date: 'DATE', p_end_date: 'DATE' }
    );

export const getAssignmentsByDate = async (c, date) =>
    await executeQuery(c, `
        SELECT a.id,
               a.employee_number AS "employeeNumber",
               z.code            AS "zoneCode",
               a.shift,
               a.assignment_date AS "assignmentDate"
        FROM restaurant_assignments a
        JOIN restaurant_zones z ON a.zone_id = z.id
        WHERE a.assignment_date = $1::DATE
    `, [date]);

export const deleteAssignment = async (c, id) =>
    await executeStoredProcedure(c, 'sp_delete_assignment', { p_id: id }, { p_id: 'UUID' });
