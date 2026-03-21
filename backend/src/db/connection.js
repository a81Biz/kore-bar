// src/db/connection.js
// ============================================================
// Adaptador Unificado de Base de Datos (Cloudflare & Local)
// ============================================================

let _pool = null;
let _pgModule = null; // Caché del import

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found. Set DATABASE_URL.');

    // Normalizar placeholders ? → $1, $2...
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    if (!_pgModule) {
        _pgModule = await import('pg');
    }
    const pg = _pgModule.default;

    const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('@db') || dbUrl.includes('@postgres');
    const isCloudflare = typeof WebSocketPair !== 'undefined';

    // ── RUTA A: LOCAL / DOCKER / TEST (Singleton Pool) ──
    if (!isCloudflare) {
        if (!_pool) {
            _pool = new pg.Pool({
                connectionString: dbUrl,
                max: 10,
                idleTimeoutMillis: 30000,
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }
        const result = await _pool.query(pgQuery, params);
        return result.rows;
    }

    // ── RUTA B: CLOUDFLARE WORKERS (Cliente Efímero con Auto-Retry) ──
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        const client = new pg.Client({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
            query_timeout: 10000
        });

        try {
            await client.connect();
            const result = await client.query(pgQuery, params);

            // Éxito: Cierre limpio en el fondo
            const endPromise = client.end().catch(() => { });
            if (c && c.executionCtx && c.executionCtx.waitUntil) c.executionCtx.waitUntil(endPromise);

            return result.rows;

        } catch (error) {
            // Limpieza obligatoria del cliente fallido
            const endPromise = client.end().catch(() => { });
            if (c && c.executionCtx && c.executionCtx.waitUntil) c.executionCtx.waitUntil(endPromise);

            const errMsg = error.message || '';

            // Si Supabase cortó la conexión por saturación, reintentamos de forma invisible
            if (errMsg.includes('terminated unexpectedly') || errMsg.includes('ECONNRESET') || errMsg.includes('socket closed')) {
                console.warn(`[DB] Micro-corte en Supabase. Reintentando de forma invisible (${attempts}/${maxAttempts})...`);
                if (attempts >= maxAttempts) throw error;
                // Backoff exponencial: Espera 200ms, luego 400ms antes de reintentar
                await new Promise(resolve => setTimeout(resolve, 200 * attempts));
                continue;
            }

            console.error('PostgreSQL Query Error:', error);
            throw error;
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