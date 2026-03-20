// src/db/connection.js
// ============================================================
// Adaptador Condicional de Base de Datos
//
// Switch inteligente según el entorno de ejecución:
//   • Cloudflare Workers → @neondatabase/serverless (HTTP/WebSocket)
//   • Local / Vitest / CI → pg (TCP socket estándar, import dinámico)
//
// IMPORTANTE: pg se importa DINÁMICAMENTE dentro del bloque Node.js
// para que esbuild NO intente empaquetar net/tls al compilar para Workers.
// ============================================================

// ── Pool singleton para entorno Node.js (local / CI) ─────────
// Se inicializa de forma lazy la primera vez que se necesita.
let _pool = null;

/**
 * Detecta si estamos corriendo dentro de Cloudflare Workers.
 * En Workers el userAgent del navegador global es 'Cloudflare-Workers'.
 * Con nodejs_compat, process existe como polyfill pero process.versions.node no.
 */
function isCloudflareEnv(c) {
    return !!(c?.env?.DATABASE_URL) && typeof process?.versions?.node !== 'string';
}

/**
 * Ejecuta una query SQL.
 *
 * @param {Object} c - Contexto de Hono
 * @param {string} query - Query SQL (placeholders: $1, $2... o ?)
 * @param {Array} params - Parámetros
 * @returns {Promise<Array>} - Filas resultantes
 */
export const executeQuery = async (c, query, params = []) => {

    // ── Normalizar placeholders ? → $1, $2... ────────────────
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    // ── Ruta A: Cloudflare Workers (serverless HTTP/WebSocket) ─
    if (isCloudflareEnv(c)) {
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(c.env.DATABASE_URL);

        try {
            const results = await sql(pgQuery, params);
            return results;
        } catch (error) {
            console.error('Neon (Serverless) Query Error:', error);
            throw error;
        }
    }

    // ── Ruta B: Node.js local / Vitest / CI (TCP) ────────────
    // pg se importa DINÁMICAMENTE aquí para que esbuild no intente
    // empaquetar net y tls cuando compila el bundle para Workers.
    const dbUrl = c?.env?.DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('No database connection configuration found. Set DATABASE_URL.');
    }

    if (!_pool) {
        const { default: pg } = await import('pg');
        const { Pool } = pg;
        _pool = new Pool({
            connectionString: dbUrl,
            max: 10,
            idleTimeoutMillis: 30000
        });
    }

    try {
        const result = await _pool.query(pgQuery, params);
        return result.rows;
    } catch (error) {
        console.error('PostgreSQL Query Error:', error);
        throw error;
    }
};

/**
 * Ejecuta un Procedimiento Almacenado (Mutación) mapeando un objeto a parámetros posicionales.
 * @param {Object} c - Contexto de Hono
 * @param {String} procedureName - Nombre del SP (ej. 'sp_upsert_employee')
 * @param {Object} params - Objeto literal con los parámetros
 * @param {Object} types - Mapa de casteos explícitos (ej. { ids: 'int[]' })
 * @returns {Promise<any>}
 */
export const executeStoredProcedure = async (c, procedureName, params = {}, types = {}) => {
    const entries = Object.entries(params);
    const values = entries.map(([_, v]) => v);
    const placeholders = entries.map(([key, _], index) => {
        const cast = types[key];
        return cast ? `$${index + 1}::${cast}` : `$${index + 1}`;
    }).join(', ');

    const query = `CALL ${procedureName}(${placeholders});`;
    return await executeQuery(c, query, values);
};