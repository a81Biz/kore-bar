// ============================================================
// auth.helper.js
// Handlers de autenticación para el Workflow Engine.
//
// Dos flujos independientes:
//   1. loginHandler      → admin web  (password + bcrypt → JWT en cookie httpOnly)
//   2. validatePinHandler → POS       (PIN numérico     → JWT en Bearer header)
//
// MIGRACIÓN: jsonwebtoken → hono/jwt (WebCrypto nativo, 100% compatible Workers)
// El JWT incluye: employeeNumber, roleCode, areaCode, type ('session'|'pin')
// ============================================================

import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { getUserForLogin, getUserForPin } from '../models/auth.model.js';

const JWT_SECRET = process.env.JWT_SECRET || 'kore_dev_secret_change_in_prod';

// Convierte strings tipo '8h', '12h', '3600' a segundos
const parseExpiryToSeconds = (v) => {
    if (!v) return 28800;
    const m = String(v).match(/^(\d+)([smhd]?)$/);
    if (!m) return 28800;
    const n = parseInt(m[1], 10);
    const unit = m[2] || 'h';
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit] ?? 3600);
};

const JWT_EXPIRES_WEB_SEC = parseExpiryToSeconds(process.env.JWT_EXPIRES_WEB || '8h');
const JWT_EXPIRES_POS_SEC = parseExpiryToSeconds(process.env.JWT_EXPIRES_POS || '12h');


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
// Fallo: 401 con mensaje genérico

export const loginHandler = async (state, c) => {
    const { employeeNumber, password } = state.payload;

    // 1. Buscar usuario en BD
    const user = await getUserForLogin(c, employeeNumber);

    // 2. Validación en tiempo constante
    const DUMMY_HASH = '$2b$10$invalidhashtopreventtimingattacks000000000000000000';
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValid || !user.isActive) {
        throw authError('Credenciales inválidas');
    }

    // 3. Construir payload del token
    const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRES_WEB_SEC;
    const tokenPayload = {
        employeeNumber: user.employeeNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.roleCode,
        areaCode: user.areaCode,
        type: 'session',
        exp
    };

    // 4. Firmar JWT con hono/jwt (WebCrypto — compatible con Workers)
    const token = await sign(tokenPayload, JWT_SECRET);

    // 5. Establecer cookie httpOnly
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
// Éxito: JWT firmado en body como { token }
// Fallo: 401 con mensaje genérico

export const validatePinHandler = async (state, c) => {
    const { employeeNumber, pinCode } = state.payload;

    // 1. Verificar PIN contra BD
    const user = await getUserForPin(c, employeeNumber, String(pinCode));

    if (!user || !user.isPinValid) {
        throw authError('PIN inválido');
    }

    // 2. Construir payload del token POS
    const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRES_POS_SEC;
    const tokenPayload = {
        employeeNumber: user.employeeNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.roleCode ?? 'POS',
        areaCode: user.areaCode,
        canAccessCashier: user.canAccessCashier ?? false,
        type: 'pin',
        exp
    };

    // 3. Firmar JWT con hono/jwt (WebCrypto — compatible con Workers)
    const token = await sign(tokenPayload, JWT_SECRET);

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