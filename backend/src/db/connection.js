// src/db/connection.js
// ============================================================
// Adaptador Unificado de Base de Datos (Cloudflare & Local)
// ============================================================

/**
 * Función segura para encontrar la URL sin importar dónde estemos
 */
const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

/**
 * Ejecuta una query SQL con un Cliente Efímero (A prueba de Serverless)
 */
export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);

    if (!dbUrl) {
        throw new Error('No database connection configuration found. Set DATABASE_URL.');
    }

    // Normalizar placeholders ? → $1, $2...
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    // Importación dinámica cacheada
    const { default: pg } = await import('pg');

    // USAMOS CLIENT EN LUGAR DE POOL PARA EVITAR CONEXIONES ZOMBIS EN CLOUDFLARE
    const client = new pg.Client({
        connectionString: dbUrl,
        connectionTimeoutMillis: 10000 // Si Supabase no responde en 10s, aborta en lugar de colgarse
    });

    try {
        await client.connect();
        const result = await client.query(pgQuery, params);
        return result.rows;
    } catch (error) {
        console.error('PostgreSQL Query Error:', error);
        throw error;
    } finally {
        // CRÍTICO: Cerrar la conexión para que el Worker de Cloudflare pueda terminar exitosamente
        await client.end().catch(err => console.error('Error closing DB client:', err));
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