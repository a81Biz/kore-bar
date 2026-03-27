// ============================================================
// auth.helper.js
// Handlers de autenticación para el Workflow Engine.
//
// Dos flujos independientes:
//   1. loginHandler      → admin web  (password + bcrypt → JWT en cookie httpOnly)
//   2. validatePinHandler → POS       (PIN + bcrypt     → JWT en Bearer header)
//
// CAMBIOS vs versión anterior:
//   - validatePinHandler ahora usa bcrypt.compare() en vez de plain text
//   - Agrega validación de canAccessCashier para contexto 'cashier'
//   - PIN se compara en tiempo constante con DUMMY_HASH (anti-timing)
//
// MIGRACIÓN: jsonwebtoken → hono/jwt (WebCrypto nativo, 100% compatible Workers)
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

// Hash falso para comparación en tiempo constante cuando el usuario no existe
const DUMMY_HASH = '$2b$10$invalidhashtopreventtimingattacks000000000000000000';


// ── UTILIDAD INTERNA ──────────────────────────────────────────

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
// Body:  { employeeNumber, pinCode, context? }
// Éxito: JWT firmado en body como { token }
// Fallo: 401 con mensaje genérico
//
// CAMBIO: Ahora usa bcrypt.compare() en vez de comparación plain text.
// El campo `context` es opcional y permite validar permisos adicionales:
//   - 'cashier' → requiere canAccessCashier = true en el área del empleado
//   - 'kitchen' → sin restricción adicional (cualquier empleado con PIN)
//   - 'waiter'  → sin restricción adicional
//   - undefined → sin restricción adicional (compatibilidad)

export const validatePinHandler = async (state, c) => {
    const { employeeNumber, pinCode, context } = state.payload;

    // 1. Buscar empleado en BD (ya NO se envía el PIN al SQL)
    const user = await getUserForPin(c, employeeNumber);

    // 2. Comparar PIN con bcrypt en tiempo constante
    const hashToCompare = user?.pinHash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(String(pinCode), hashToCompare);

    if (!user || !isValid || !user.isActive) {
        throw authError('PIN inválido');
    }

    // 3. Validar permisos por contexto
    if (context === 'cashier' && !user.canAccessCashier) {
        throw authError('Sin permiso de acceso a caja. Tu área no tiene habilitado el acceso.', 403);
    }

    // 4. Construir payload del token POS
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

    // 5. Firmar JWT con hono/jwt (WebCrypto — compatible con Workers)
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
