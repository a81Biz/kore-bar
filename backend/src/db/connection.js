// src/db/connection.js
// ============================================================
// Adaptador Unificado de Base de Datos (Cloudflare & Local)
// ============================================================

// Usamos un Pool global (Singleton) para reutilizar conexiones
// y evitar abrir/cerrar sockets en cada petición, lo que causaba los "Hangs".
let _pool = null;

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);

    if (!dbUrl) {
        throw new Error('No database connection configuration found. Set DATABASE_URL.');
    }

    // Normalizar placeholders ? → $1, $2...
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    // Inicialización Lazy del Pool
    if (!_pool) {
        const { default: pg } = await import('pg');
        const { Pool } = pg;

        // 🟢 NUEVO: Detectamos si es una base de datos local (Docker/Vitest) para apagar el SSL
        const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('@db') || dbUrl.includes('@postgres');

        _pool = new Pool({
            connectionString: dbUrl,
            max: 5,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 10000,
            // Si es local apagamos el SSL, si es la nube lo exigimos pero sin validar certificado
            ssl: isLocalDb ? false : { rejectUnauthorized: false }
        });
    }

    try {
        // Ejecutamos la consulta. El Pool maneja la conexión y la devuelve automáticamente.
        const result = await _pool.query(pgQuery, params);
        return result.rows;
    } catch (error) {
        console.error('PostgreSQL Query Error:', error);
        throw error;
    }
};

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