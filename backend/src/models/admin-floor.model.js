import { executeQuery } from '../db/connection.js';

// ==========================================
// ZONAS
// ==========================================
export const createZone = async (c, code, name) => await executeQuery(c, 'SELECT sp_create_zone($1::VARCHAR, $2::VARCHAR)', [code, name]);
export const updateZone = async (c, code, name, isActive) => await executeQuery(c, 'SELECT sp_update_zone($1::VARCHAR, $2::VARCHAR, $3::BOOLEAN)', [code, name, isActive]);
export const getActiveZones = async (c) => await executeQuery(c, 'SELECT code AS "zoneCode", name, is_active AS "isActive" FROM restaurant_zones ORDER BY created_at ASC');
export const deleteZoneSmart = async (c, code) => await executeQuery(c, 'SELECT sp_delete_zone_smart($1::VARCHAR)', [code]);

// ==========================================
// MESAS
// ==========================================
export const createTable = async (c, code, zoneCode, capacity) => await executeQuery(c, 'SELECT sp_create_table($1::VARCHAR, $2::VARCHAR, $3::INT)', [code, zoneCode, capacity]);
export const updateTable = async (c, code, zoneCode, capacity, isActive) => await executeQuery(c, 'SELECT sp_update_table($1::VARCHAR, $2::VARCHAR, $3::INT, $4::BOOLEAN)', [code, zoneCode, capacity, isActive]);
export const getActiveTables = async (c) => await executeQuery(c, 'SELECT t.code AS "tableId", z.code AS "zoneCode", t.capacity, t.is_active AS "isActive" FROM restaurant_tables t JOIN restaurant_zones z ON t.zone_id = z.id ORDER BY t.code ASC');
export const deleteTableSmart = async (c, id) => await executeQuery(c, 'SELECT sp_delete_table_smart($1::VARCHAR)', [id]);

// ==========================================
// ASIGNACIONES OPERATIVAS
// ==========================================
export const createAssignmentRange = async (c, empNum, zoneCode, shift, startDate, endDate) => {
    return await executeQuery(c,
        'SELECT sp_create_assignment_range($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::DATE, $5::DATE)',
        [empNum, zoneCode, shift, startDate, endDate]
    );
};
export const getAssignmentsByDate = async (c, date) => await executeQuery(c, 'SELECT a.id, a.employee_number AS "employeeNumber", z.code AS "zoneCode", a.shift, a.assignment_date AS "assignmentDate" FROM restaurant_assignments a JOIN restaurant_zones z ON a.zone_id = z.id WHERE a.assignment_date = $1::DATE', [date]); export const deleteAssignment = async (c, id) => await executeQuery(c, 'DELETE FROM restaurant_assignments WHERE id = $1::UUID', [id]);