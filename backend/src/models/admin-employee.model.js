import { executeStoredProcedure, executeQuery } from '../db/connection.js';

export const upsertHrCatalog = async (c, catalogItem) => {
    await executeStoredProcedure(c, 'sp_upsert_hr_catalog', {
        p_area_code: catalogItem.areaId,
        p_area_name: catalogItem.areaName,
        p_job_code:  catalogItem.jobTitleId,
        p_job_name:  catalogItem.jobTitleName
    });
};

export const upsertEmployee = async (c, emp) => {
    await executeStoredProcedure(c, 'sp_upsert_employee', {
        p_employee_number: emp.employeeNumber,
        p_first_name:      emp.firstName,
        p_last_name:       emp.lastName,
        p_area_code:       emp.areaId,
        p_job_code:        emp.jobTitleId,
        p_hire_date:       emp.hireDate,
        p_is_active:       emp.isActive,
        p_pin_code:        emp.pinCode
    });
};

export const checkEmployeeExists = async (c, employeeNumber) => {
    const res = await executeQuery(c, `SELECT * FROM fn_check_employee_exists($1)`, [employeeNumber]);
    return res.length > 0 ? res[0] : null;
};

export const getAllEmployees = async (c) => {
    return await executeQuery(c, `SELECT * FROM vw_directory_employees`);
};

export const deactivateEmployee = async (c, employeeNumber) => {
    await executeStoredProcedure(c, 'sp_deactivate_employee', {
        p_employee_number: employeeNumber
    });
};

export const getAllAreas = async (c) => {
    return await executeQuery(c, `
        SELECT id, code, name, description, can_access_cashier
        FROM areas
        WHERE is_active = true
        ORDER BY code ASC
    `);
};

export const getAllJobTitles = async (c) => {
    return await executeQuery(c, `
        SELECT id, code, name, description
        FROM job_titles
        WHERE is_active = true
        ORDER BY code ASC
    `);
};

// ── Áreas — antes eran UPDATE/INSERT raw, ahora delegan al SP ────────────────

export const insertAreaModel = async (c, code, name, canAccessCashier = false) => {
    await executeStoredProcedure(c, 'sp_create_area', {
        p_code:               code,
        p_name:               name,
        p_can_access_cashier: canAccessCashier
    });
};

export const updateAreaModel = async (c, code, name) => {
    await executeStoredProcedure(c, 'sp_update_area', {
        p_code: code,
        p_name: name
    });
};

export const deactivateAreaModel = async (c, code) => {
    await executeStoredProcedure(c, 'sp_deactivate_area', {
        p_code: code
    });
};

export const bulkDeactivateAreasModel = async (c, codes) => {
    await executeStoredProcedure(
        c,
        'sp_bulk_deactivate_areas',
        { p_codes: codes },
        { p_codes: 'VARCHAR[]' }
    );
};

// ── Puestos — antes eran UPDATE/INSERT raw, ahora delegan al SP ─────────────

export const insertJobTitleModel = async (c, code, name) => {
    await executeStoredProcedure(c, 'sp_create_job_title', {
        p_code: code,
        p_name: name
    });
};

export const updateJobTitleModel = async (c, code, name) => {
    await executeStoredProcedure(c, 'sp_update_job_title', {
        p_code: code,
        p_name: name
    });
};

export const deactivateJobTitleModel = async (c, code) => {
    await executeStoredProcedure(c, 'sp_deactivate_job_title', {
        p_code: code
    });
};

export const bulkDeactivateJobTitlesModel = async (c, codes) => {
    await executeStoredProcedure(
        c,
        'sp_bulk_deactivate_job_titles',
        { p_codes: codes },
        { p_codes: 'VARCHAR[]' }
    );
};

export const viewDictionaryPositions = async (c, code) => {
    return await executeQuery(c, `
        SELECT 1 FROM vw_dictionary_positions WHERE position_code = $1 LIMIT 1
    `, [code]);
};
