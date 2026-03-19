import { executeStoredProcedure, executeQuery } from '../db/connection.js';

export const upsertHrCatalog = async (c, catalogItem) => {
    await executeStoredProcedure(c, 'sp_upsert_hr_catalog', {
        p_area_code: catalogItem.areaId,
        p_area_name: catalogItem.areaName,
        p_job_code: catalogItem.jobTitleId,
        p_job_name: catalogItem.jobTitleName
    });
};

export const upsertEmployee = async (c, emp) => {
    await executeStoredProcedure(c, 'sp_upsert_employee', {
        p_employee_number: emp.employeeNumber,
        p_first_name: emp.firstName,
        p_last_name: emp.lastName,
        p_area_code: emp.areaId,
        p_job_code: emp.jobTitleId,
        p_hire_date: emp.hireDate,
        p_is_active: emp.isActive,
        p_pin_code: emp.pinCode
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

// FIX 2: se agrega can_access_cashier al SELECT
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

export const updateAreaModel = async (c, code, name) => {
    await executeQuery(c, `
        UPDATE areas SET name = $1, updated_at = NOW() WHERE code = $2
    `, [name, code]);
};

export const deactivateAreaModel = async (c, code) => {
    await executeQuery(c, `
        UPDATE areas SET is_active = false, updated_at = NOW() WHERE code = $1
    `, [code]);
};

export const updateJobTitleModel = async (c, code, name) => {
    await executeQuery(c, `
        UPDATE job_titles SET name = $1, updated_at = NOW() WHERE code = $2
    `, [name, code]);
};

export const deactivateJobTitleModel = async (c, code) => {
    await executeQuery(c, `
        UPDATE job_titles SET is_active = false, updated_at = NOW() WHERE code = $1
    `, [code]);
};

// FIX 3: se agrega can_access_cashier como parámetro opcional (default false)
export const insertAreaModel = async (c, code, name, canAccessCashier = false) => {
    await executeQuery(c, `
        INSERT INTO areas (code, name, can_access_cashier)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE
        SET name               = EXCLUDED.name,
            can_access_cashier = EXCLUDED.can_access_cashier,
            is_active          = true,
            updated_at         = NOW()
    `, [code, name, canAccessCashier]);
};

export const insertJobTitleModel = async (c, code, name) => {
    await executeQuery(c, `
        INSERT INTO job_titles (code, name)
        VALUES ($1, $2)
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name, is_active = true, updated_at = NOW()
    `, [code, name]);
};

export const bulkDeactivateAreasModel = async (c, codes) => {
    const placeholders = codes.map((_, i) => `$${i + 1}`).join(',');
    await executeQuery(c, `
        UPDATE areas SET is_active = false, updated_at = NOW()
        WHERE code IN (${placeholders})
    `, codes);
};

export const bulkDeactivateJobTitlesModel = async (c, codes) => {
    const placeholders = codes.map((_, i) => `$${i + 1}`).join(',');
    await executeQuery(c, `
        UPDATE job_titles SET is_active = false, updated_at = NOW()
        WHERE code IN (${placeholders})
    `, codes);
};

// FIX 1: se agrega return para que el llamador reciba el resultado
export const viewDictionaryPositions = async (c, code) => {
    return await executeQuery(c, `
        SELECT 1 FROM vw_dictionary_positions WHERE position_code = $1 LIMIT 1
    `, [code]);
};