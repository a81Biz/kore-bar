// ============================================================
// pin.util.js
// Utilidad centralizada para hasheo de PINs
//
// REGLA: Todo PIN debe pasar por hashPin() antes de guardarse
// en la BD. Queda PROHIBIDO guardar PINs en texto plano.
// ============================================================

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashea un PIN numérico con bcrypt.
 * @param {string} pin — PIN de 4-6 dígitos en texto plano
 * @returns {Promise<string>} — Hash bcrypt ($2b$10$...)
 */
export const hashPin = async (pin) => {
    if (!pin || typeof pin !== 'string') return null;
    return await bcrypt.hash(pin, SALT_ROUNDS);
};

/**
 * Valida que un PIN cumpla el formato requerido (4-6 dígitos numéricos).
 * @param {string} pin — PIN a validar
 * @returns {boolean}
 */
export const isValidPinFormat = (pin) => {
    if (!pin || typeof pin !== 'string') return false;
    return /^\d{4,6}$/.test(pin);
};
