// ============================================================
// auth.middleware.js
// MIGRACIÓN: jsonwebtoken → hono/jwt (verify es async, usa WebCrypto)
// Compatible 100% con Cloudflare Workers sin polyfills adicionales.
// ============================================================

import { verify } from 'hono/jwt';
import { AppError } from '../utils/errors.util.js';

const JWT_SECRET = process.env.JWT_SECRET || 'kore_dev_secret_change_in_prod';

// ── UTILIDADES ────────────────────────────────────────────────

/**
 * Extrae y verifica el JWT desde cookie (admin) o Bearer header (POS).
 * Retorna el payload decodificado o lanza AppError 401.
 * ASYNC: hono/jwt.verify usa WebCrypto que es siempre asíncrono.
 */
const extractAndVerifyToken = async (c) => {
    // 1. Intentar desde cookie (admin web)
    const cookieHeader = c.req.header('Cookie') ?? '';
    const cookieMatch = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
    const cookieToken = cookieMatch?.[1];

    // 2. Intentar desde Authorization: Bearer (POS)
    const authHeader = c.req.header('Authorization') ?? '';
    const bearerToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    const token = cookieToken ?? bearerToken;

    if (!token) {
        throw new AppError('No autorizado — sesión requerida', 401);
    }

    try {
        // hono/jwt.verify retorna Promise<JWTPayload> y valida exp automáticamente
        return await verify(token, JWT_SECRET, "HS256");
    } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('expir') || msg.includes('exp')) {
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
    if (authType === 'pin') {
        return async (c, next) => {
            const payload = await extractAndVerifyToken(c);

            if (payload.type !== 'pin' && payload.type !== 'session') {
                throw new AppError('Tipo de sesión incorrecto para este endpoint', 403);
            }

            c.set('user', payload);
            await next();
        };
    }

    // ── Usuario + contraseña (admin web / gerencia) ───────────
    if (authType === 'session') {
        return async (c, next) => {
            const payload = await extractAndVerifyToken(c);

            if (payload.type !== 'session') {
                throw new AppError('Este endpoint requiere sesión de usuario web', 403);
            }

            c.set('user', payload);
            await next();
        };
    }

    // ── Área específica (ej: "area:CAJA", "area:GERENCIA") ────
    if (authType.startsWith('area:')) {
        const requiredArea = authType.split(':')[1]?.toUpperCase();

        return async (c, next) => {
            const payload = await extractAndVerifyToken(c);

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
    return async (_c, _next) => {
        throw new AppError(`Tipo de autenticación no implementado: '${authType}'`, 501);
    };
};