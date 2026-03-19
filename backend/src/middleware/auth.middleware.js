// ============================================================
// auth.middleware.js
// Lee el tipo de auth desde el schema y aplica la regla
// correspondiente.
//
// Tipos soportados (campo api.auth en el schema JSON):
//   none          → público, sin validación
//   session       → JWT en cookie httpOnly `session` (admin web)
//   pin           → JWT en header Authorization: Bearer (POS)
//   area:<CODE>   → igual que session/pin + verifica areaCode del token
// ============================================================

import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.util.js';

const JWT_SECRET = process.env.JWT_SECRET || 'kore_dev_secret_change_in_prod';

// ── UTILIDADES ────────────────────────────────────────────────

/**
 * Extrae y verifica el JWT desde cookie (admin) o Bearer header (POS).
 * Retorna el payload decodificado o lanza AppError 401.
 */
const extractAndVerifyToken = (c) => {
    // 1. Intentar desde cookie (admin web)
    const cookieHeader = c.req.header('Cookie') ?? '';
    const cookieMatch  = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
    const cookieToken  = cookieMatch?.[1];

    // 2. Intentar desde Authorization: Bearer (POS)
    const authHeader  = c.req.header('Authorization') ?? '';
    const bearerToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    const token = cookieToken ?? bearerToken;

    if (!token) {
        throw new AppError('No autorizado — sesión requerida', 401);
    }

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new AppError('Sesión expirada — vuelve a iniciar sesión', 401);
        }
        throw new AppError('Token inválido', 401);
    }
};


// ── BUILDER DE MIDDLEWARE ─────────────────────────────────────

/**
 * Genera un middleware de autenticación basado en el tipo
 * declarado en el campo api.auth del schema JSON.
 *
 * @param {string|undefined} authType - Valor de schema.api.auth
 * @returns {Function} Middleware de Hono async (c, next) => void
 */
export const buildAuthMiddleware = (authType) => {

    // ── Sin auth o explícitamente pública ─────────────────────
    if (!authType || authType === 'none') {
        return async (c, next) => await next();
    }

    // ── PIN numérico (mesero / cajero / cocina) ───────────────
    // Espera JWT firmado en Authorization: Bearer emitido por
    // POST /auth/pin. El token incluye type: 'pin'.
    if (authType === 'pin') {
        return async (c, next) => {
            const payload = extractAndVerifyToken(c);

            if (payload.type !== 'pin' && payload.type !== 'session') {
                throw new AppError('Tipo de sesión incorrecto para este endpoint', 403);
            }

            // Inyectar datos del usuario en el contexto para que
            // los helpers puedan acceder sin re-consultar la BD.
            c.set('user', payload);
            await next();
        };
    }

    // ── Usuario + contraseña (admin web / gerencia) ───────────
    // Espera JWT en cookie httpOnly `session` emitido por
    // POST /auth/login. El token incluye type: 'session'.
    if (authType === 'session') {
        return async (c, next) => {
            const payload = extractAndVerifyToken(c);

            if (payload.type !== 'session') {
                throw new AppError('Este endpoint requiere sesión de usuario web', 403);
            }

            c.set('user', payload);
            await next();
        };
    }

    // ── Área específica (ej: "area:CAJA", "area:GERENCIA") ────
    // Acepta tanto tokens de tipo 'session' como 'pin'.
    // Verifica además que el areaCode del token coincida.
    if (authType.startsWith('area:')) {
        const requiredArea = authType.split(':')[1]?.toUpperCase();

        return async (c, next) => {
            const payload = extractAndVerifyToken(c);

            if (!payload.areaCode) {
                throw new AppError('Token sin área asignada', 403);
            }

            if (payload.areaCode.toUpperCase() !== requiredArea) {
                throw new AppError(
                    `Acceso restringido al área ${requiredArea}. Tu área: ${payload.areaCode}`,
                    403
                );
            }

            c.set('user', payload);
            await next();
        };
    }

    // ── Tipo desconocido — falla explícita ────────────────────
    // Nunca dejar un endpoint sin proteger por error de tipeo
    // en el campo api.auth del schema JSON.
    return async (_c, _next) => {
        throw new AppError(`Tipo de autenticación no implementado: '${authType}'`, 501);
    };
};
