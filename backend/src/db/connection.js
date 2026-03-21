// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido Anti-Deadlocks
// ============================================================

// 🟢 PROMESA SINGLETON: Evita que peticiones concurrentes traben a Cloudflare
let _pgPromise = null;
let _pool = null;

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

// Función de carga segura: todas las peticiones esperan a la misma promesa
const getPg = async () => {
    if (!_pgPromise) {
        _pgPromise = import('pg').then(m => m.default);
    }
    return await _pgPromise;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found. Set DATABASE_URL.');

    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    // Cargamos la librería de forma 100% segura contra concurrencia
    const pg = await getPg();

    const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('@db');
    const isCloudflare = typeof WebSocketPair !== 'undefined';

    // ─── RUTA A: LOCAL / DOCKER / TESTS (Pool Nativo) ───
    if (!isCloudflare) {
        if (!_pool) {
            _pool = new pg.Pool({
                connectionString: dbUrl,
                max: 15, // Perfecto para tests paralelos
                idleTimeoutMillis: 30000,
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }
        try {
            const result = await _pool.query(pgQuery, params);
            return result.rows;
        } catch (error) {
            console.error('Local Query Error:', error);
            throw error;
        }
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (Cliente Efímero) ───
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;

        const client = new pg.Client({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
            query_timeout: 15000
        });

        try {
            await client.connect();
            const result = await client.query(pgQuery, params);
            return result.rows;

        } catch (error) {
            const errMsg = error.message || '';

            if (errMsg.includes('terminated unexpectedly') || errMsg.includes('ECONNRESET') || errMsg.includes('closed')) {
                if (attempts >= maxAttempts) {
                    console.error('[DB] FATAL - Rechazo tras 3 reintentos:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 200 * attempts));
                continue;
            }

            console.error('[DB] Cloudflare Query Error:', error);
            throw error;

        } finally {
            // Cerramos la llave con candado para no dejar conexiones Zombis
            await client.end().catch(() => { });
        }
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