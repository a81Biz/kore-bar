// ============================================================
// auth.helper.js
// Handlers de autenticación para el Workflow Engine.
//
// Dos flujos independientes:
//   1. loginHandler      → admin web  (password + bcrypt → JWT en cookie httpOnly)
//   2. validatePinHandler → POS       (PIN numérico     → JWT en Bearer header)
//
// El JWT incluye: employeeNumber, roleCode, areaCode, type ('session'|'pin')
// ============================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserForLogin, getUserForPin } from '../models/auth.model.js';

const JWT_SECRET = process.env.JWT_SECRET || 'kore_dev_secret_change_in_prod';
const JWT_EXPIRES_WEB = process.env.JWT_EXPIRES_WEB || '8h';   // turno admin
const JWT_EXPIRES_POS = process.env.JWT_EXPIRES_POS || '12h';  // turno POS


// ── UTILIDAD INTERNA ──────────────────────────────────────────

/**
 * Crea un error operacional con statusCode para que el SchemaRouter
 * lo atrape y devuelva el código HTTP correcto.
 */
const authError = (message, statusCode = 401) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.isOperational = true;
    return err;
};


// ── HANDLER 1: LOGIN WEB (admin / gerencia) ───────────────────
// Flujo: POST /auth/login
// Body:  { employeeNumber, password }
// Éxito: JWT firmado en cookie httpOnly `session`
// Fallo: 401 con mensaje genérico (nunca revelar si el usuario existe)

export const loginHandler = async (state, c) => {
    const { employeeNumber, password } = state.payload;

    // 1. Buscar usuario en BD
    const user = await getUserForLogin(c, employeeNumber);

    // 2. Validación en tiempo constante — bcrypt.compare falla
    //    de forma segura si user es null (usa un hash dummy)
    const DUMMY_HASH = '$2b$10$invalidhashtopreventtimingattacks000000000000000000';
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValid || !user.isActive) {
        throw authError('Credenciales inválidas');
    }

    // 3. Construir payload del token
    const tokenPayload = {
        employeeNumber: user.employeeNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.roleCode,
        areaCode: user.areaCode,
        type: 'session'
    };

    // 4. Firmar JWT
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_WEB });

    // 5. Establecer cookie httpOnly (admin web usa cookie, no Bearer)
    c.header('Set-Cookie', [
        `session=${token}`,
        'HttpOnly',
        'SameSite=Strict',
        'Path=/',
        process.env.NODE_ENV === 'production' ? 'Secure' : ''
    ].filter(Boolean).join('; '));

    return {
        ...state,
        data: {
            employeeNumber: user.employeeNumber,
            firstName: user.firstName,
            lastName: user.lastName,
            roleCode: user.roleCode,
            areaCode: user.areaCode
        },
        message: `Bienvenido, ${user.firstName}`
    };
};


// ── HANDLER 2: VALIDAR PIN (meseros / caja / cocina) ─────────
// Flujo: POST /auth/pin
// Body:  { employeeNumber, pinCode }
// Éxito: JWT firmado en body como { token } (POS lo guarda en memoria)
// Fallo: 401 con mensaje genérico

export const validatePinHandler = async (state, c) => {
    const { employeeNumber, pinCode } = state.payload;

    // 1. Verificar PIN contra BD
    const user = await getUserForPin(c, employeeNumber, String(pinCode));

    if (!user || !user.isPinValid) {
        throw authError('PIN inválido');
    }

    // 2. Construir payload del token POS
    const tokenPayload = {
        employeeNumber: user.employeeNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.roleCode ?? 'POS',
        areaCode: user.areaCode,
        canAccessCashier: user.canAccessCashier ?? false,
        type: 'pin'
    };

    // 3. Firmar JWT — el POS lo guarda en memoria y lo envía
    //    como Authorization: Bearer <token> en cada petición
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_POS });

    return {
        ...state,
        data: {
            token,
            employeeNumber: user.employeeNumber,
            firstName: user.firstName,
            lastName: user.lastName,
            areaCode: user.areaCode,
            canAccessCashier: user.canAccessCashier ?? false
        },
        message: `PIN válido — ${user.firstName}`
    };
};
