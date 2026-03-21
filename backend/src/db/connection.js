// src/db/connection.js
// ============================================================
// Adaptador Condicional de Base de Datos
//
// Switch inteligente según el entorno de ejecución:
//   • Cloudflare Workers → @neondatabase/serverless (HTTP/WebSocket)
//   • Local / Vitest / CI → pg (TCP socket estándar, import dinámico)
// ============================================================

let _pool = null;

/**
 * Detecta si estamos corriendo dentro de Cloudflare Workers.
 */
const isCloudflareEnv = (c) => {
    return typeof WebSocketPair !== 'undefined' || (c && c.env !== undefined);
};

/**
 * Función segura para encontrar la URL sin importar dónde estemos
 */
const getDbUrl = (c) => {
    // 1. Cloudflare Workers
    if (c && c.env && c.env.DATABASE_URL) {
        return c.env.DATABASE_URL;
    }
    // 2. Local / Docker / Vitest / CI
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }
    return null;
};

/**
 * Ejecuta una query SQL.
 */
export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);

    if (!dbUrl) {
        throw new Error('No database connection configuration found. Set DATABASE_URL.');
    }

    // ── Normalizar placeholders ? → $1, $2... ────────────────
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    // ── Ruta A: Cloudflare Workers ───────────────────────────
    if (isCloudflareEnv(c)) {
        const { neon } = await import('@neondatabase/serverless');
        // Usamos dbUrl directamente para evitar problemas de contexto
        const sql = neon(dbUrl);

        try {
            const results = await sql(pgQuery, params);
            return results;
        } catch (error) {
            console.error('Neon (Serverless) Query Error:', error);
            throw error;
        }
    }

    // ── Ruta B: Node.js local / Vitest / CI (TCP) ────────────
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
 * Ejecuta un Procedimiento Almacenado (Mutación)
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