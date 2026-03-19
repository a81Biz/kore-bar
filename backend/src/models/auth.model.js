// ============================================================
// auth.model.js
// Capa de acceso a datos para autenticación.
// Solo ejecuta fn_* (lecturas) — no hay mutaciones de auth.
// ============================================================

import { executeQuery } from '../db/connection.js';

/**
 * Devuelve los datos del usuario + hash de password para que
 * el helper pueda comparar con bcrypt.compare().
 * Retorna null si el empleado no existe o está inactivo.
 *
 * @param {object} c - Contexto Hono (para obtener la conexión DB)
 * @param {string} employeeNumber
 * @returns {object|null}
 */
export const getUserForLogin = async (c, employeeNumber) => {
    const rows = await executeQuery(
        c,
        `SELECT * FROM fn_get_user_for_login($1)`,
        [employeeNumber]
    );
    return rows[0] ?? null;
};

/**
 * Valida un PIN numérico y devuelve los datos de sesión POS.
 * isPinValid: true solo si el PIN coincide exactamente.
 * Retorna null si el empleado no existe o está inactivo.
 *
 * @param {object} c
 * @param {string} employeeNumber
 * @param {string} pinCode
 * @returns {object|null}
 */
export const getUserForPin = async (c, employeeNumber, pinCode) => {
    const rows = await executeQuery(
        c,
        `SELECT * FROM fn_get_user_for_pin($1, $2)`,
        [employeeNumber, pinCode]
    );
    return rows[0] ?? null;
};

/**
 * Verifica si un empleado pertenece al área requerida.
 * Usado por el middleware de tipo 'area:XXX'.
 *
 * @param {object} c
 * @param {string} employeeNumber
 * @param {string} areaCode
 * @returns {boolean}
 */
export const employeeHasArea = async (c, employeeNumber, areaCode) => {
    const rows = await executeQuery(
        c,
        `SELECT fn_employee_has_area($1, $2) AS "hasArea"`,
        [employeeNumber, areaCode]
    );
    return rows[0]?.hasArea === true;
};
