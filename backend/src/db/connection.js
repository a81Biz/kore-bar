// src/db/connection.js
// ============================================================
// Adaptador Condicional de Base de Datos
//
// Switch inteligente según el entorno de ejecución:
//   • Cloudflare Workers → @neondatabase/serverless (HTTP/WebSocket)
//   • Local / Vitest / CI → pg (TCP socket estándar)
//
// Las funciones consumidoras (executeQuery, executeStoredProcedure)
// devuelven siempre un array de filas — la librería subyacente
// es transparente para el resto del backend.
// ============================================================

import pg from 'pg';

const { Pool } = pg;

// ── Pool singleton para entorno Node.js (local / CI) ─────────
// Se inicializa de forma lazy la primera vez que se necesita.
let _pool = null;

function getPool() {
    if (!_pool) {
        _pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 10,
            idleTimeoutMillis: 30000
        });
    }
    return _pool;
}

/**
 * Detecta si estamos corriendo dentro de Cloudflare Workers.
 * En Workers, c.env contiene los bindings y secrets inyectados por wrangler.
 * La clave DATABASE_URL existirá solo si fue configurada como secret del Worker.
 */
function isCloudflareEnv(c) {
    // c.env.DATABASE_URL existe en Workers; process.env no existe en Workers
    return c?.env?.DATABASE_URL && typeof process === 'undefined';
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

    // ── Ruta A: Cloudflare Workers (serverless HTTP) ─────────
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
    const dbUrl = c?.env?.DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('No database connection configuration found. Set DATABASE_URL.');
    }

    // Asegurar que el pool use la URL correcta (por si cambió entre tests)
    const pool = getPool();

    try {
        const result = await pool.query(pgQuery, params);
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