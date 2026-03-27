// ============================================================
// auth.model.js
// Capa de acceso a datos para autenticación.
// Solo ejecuta fn_* (lecturas) — no hay mutaciones de auth.
//
// CAMBIO: getUserForPin ya no recibe pinCode — la comparación
// se hace en el helper con bcrypt.compare(), no en SQL.
// ============================================================

import { executeQuery } from '../db/connection.js';

/**
 * Devuelve los datos del usuario + hash de password para que
 * el helper pueda comparar con bcrypt.compare().
 * Retorna null si el empleado no existe o está inactivo.
 */
export const getUserForLogin = async (c, employeeNumber) => {
    const rows = await executeQuery(
        c,
        `SELECT * FROM fn_get_user_for_login($1::VARCHAR)`,
        [employeeNumber]
    );
    return rows[0] ?? null;
};

/**
 * Devuelve los datos del empleado + pinHash para que el helper
 * pueda comparar con bcrypt.compare().
 * Retorna null si el empleado no existe o está inactivo.
 *
 * CAMBIO: Ya no recibe pinCode. La función SQL devuelve el hash
 * y la comparación se hace en Node con bcrypt (tiempo constante).
 */
export const getUserForPin = async (c, employeeNumber) => {
    const rows = await executeQuery(
        c,
        `SELECT * FROM fn_get_user_for_pin($1::VARCHAR)`,
        [employeeNumber]
    );
    return rows[0] ?? null;
};

/**
 * Verifica si un empleado pertenece al área requerida.
 * Usado por el middleware de tipo 'area:XXX'.
 */
export const employeeHasArea = async (c, employeeNumber, areaCode) => {
    const rows = await executeQuery(
        c,
        `SELECT fn_employee_has_area($1::VARCHAR, $2::VARCHAR) AS "hasArea"`,
        [employeeNumber, areaCode]
    );
    return rows[0]?.hasArea === true;
};
