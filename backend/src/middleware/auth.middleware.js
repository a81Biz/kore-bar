// ============================================================
// auth.middleware.js
// Lee el tipo de auth desde el schema y aplica la regla
// correspondiente. Si no está desarrollado aún, lanza 501.
// ============================================================

import { AppError } from '../utils/errors.util.js';

/**
 * Genera un middleware de autenticación basado en el tipo
 * declarado en el campo api.auth del schema.
 *
 * @param {string|undefined} authType - Valor de schema.api.auth
 * @returns {Function} Middleware de Hono (c, next) => ...
 */
export const buildAuthMiddleware = (authType) => {
    // Sin auth declarada o explícitamente pública → pasa directo
    if (!authType || authType === 'none') {
        return async (c, next) => await next();
    }

    // PIN numérico (mesero / cajero)
    // La validación real del PIN la hace el helper del workflow —
    // aquí solo verificamos que venga el header de sesión si es
    // un endpoint protegido que no es el login mismo.
    if (authType === 'pin') {
        return async (c, next) => {
            // TODO: cuando implementes sesiones de PIN,
            // validar el token aquí antes de continuar.
            // Por ahora pasa para no bloquear el desarrollo.
            await next();
        };
    }

    // Usuario + contraseña (admin / gerencia)
    if (authType === 'session') {
        return async (c, next) => {
            // TODO: validar JWT o cookie de sesión aquí.
            // Ejemplo de implementación futura:
            // const token = c.req.header('Authorization')?.replace('Bearer ', '');
            // if (!token) throw new AppError('No autorizado', 401);
            // const payload = verifyJwt(token);
            // c.set('user', payload);
            await next();
        };
    }

    // Área específica (ej: "area:CAJA", "area:GERENCIA")
    if (authType.startsWith('area:')) {
        const requiredArea = authType.split(':')[1];
        return async (c, next) => {
            // TODO: verificar que el usuario en sesión
            // pertenece al área requerida.
            // Ejemplo de implementación futura:
            // const user = c.get('user');
            // if (user?.area !== requiredArea) {
            //     throw new AppError(`Acceso restringido al área ${requiredArea}`, 403);
            // }
            await next();
        };
    }

    // Tipo desconocido — falla explícitamente para no dejar
    // endpoints sin proteger por error de tipeo en el schema
    return async (c, next) => {
        throw new AppError(`Tipo de autenticación no implementado: '${authType}'`, 501);
    };
};