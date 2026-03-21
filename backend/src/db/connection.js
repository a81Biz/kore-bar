// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido (pg local + postgres.js Edge)
// ============================================================

let _pgPromise = null;
let _postgresPromise = null;
let _pool = null;
let _sql = null;

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found.');

    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    const isCloudflare = typeof WebSocketPair !== 'undefined';
    const isLocalDb = !dbUrl.includes('supabase');

    // ─── RUTA A: LOCAL / DOCKER / TESTS (Usamos 'pg' clásico) ───
    if (!isCloudflare) {
        if (!_pgPromise) _pgPromise = import('pg').then(m => m.default || m);
        const pg = await _pgPromise;

        if (!_pool) {
            _pool = new pg.Pool({
                connectionString: dbUrl,
                max: 15,
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }
        const result = await _pool.query(pgQuery, params);
        return result.rows;
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (Usamos 'postgres.js' para Edge) ───
    if (!_postgresPromise) _postgresPromise = import('postgres').then(m => m.default || m);
    const postgres = await _postgresPromise;

    if (!_sql) {
        // Esta librería maneja el SSL y la concurrencia nativamente en Cloudflare
        _sql = postgres(dbUrl, {
            ssl: 'require',
            max: 5,
            idle_timeout: 10,
            connect_timeout: 10
        });
    }

    try {
        // sql.unsafe permite ejecutar querys crudos y Procedimientos Almacenados (CALL)
        const result = await _sql.unsafe(pgQuery, params);
        // Lo convertimos en un array estándar idéntico al que devuelve pg.Pool
        return Array.from(result);
    } catch (error) {
        console.error('[DB] Cloudflare Edge Query Error:', error);
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