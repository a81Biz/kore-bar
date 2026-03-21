// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido (Pooler Optimizado)
// ============================================================

let _pgPromise = null;
let _pool = null;

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

const getPg = async () => {
    if (!_pgPromise) {
        _pgPromise = import('pg').then(m => m.default || m);
    }
    return await _pgPromise;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found. Set DATABASE_URL.');

    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    const pg = await getPg();

    const isCloudflare = typeof WebSocketPair !== 'undefined';
    const isLocalDb = !dbUrl.includes('supabase');

    // ─── RUTA A: LOCAL / DOCKER / TESTS (Pool) ───
    if (!isCloudflare) {
        if (!_pool) {
            _pool = new pg.Pool({
                connectionString: dbUrl,
                max: 15,
                // Si es local apagamos SSL, si es Supabase dejamos que la URL actúe
                ssl: isLocalDb ? false : undefined
            });
        }
        const result = await _pool.query(pgQuery, params);
        return result.rows;
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (Cliente Efímero) ───
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;

        // 🟢 CRÍTICO: Cero configuración SSL manual. La URL (?sslmode=require) hace el trabajo.
        const client = new pg.Client({
            connectionString: dbUrl,
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
                if (attempts >= maxAttempts) throw error;
                await new Promise(resolve => setTimeout(resolve, 200 * attempts));
                continue;
            }
            console.error('[DB] Cloudflare Query Error:', error);
            throw error;

        } finally {
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