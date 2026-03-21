// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido (Semáforo + SSL Forzado)
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

// 🚦 SEMÁFORO: Previene que tu frontend sature a Supabase abriendo 4 conexiones de golpe
class Mutex {
    constructor() { this.queue = []; this.locked = false; }
    async lock() {
        return new Promise(resolve => {
            if (!this.locked) { this.locked = true; resolve(); }
            else { this.queue.push(resolve); }
        });
    }
    unlock() {
        if (this.queue.length > 0) { const next = this.queue.shift(); next(); }
        else { this.locked = false; }
    }
}
const dbMutex = new Mutex();

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found.');

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
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }
        const result = await _pool.query(pgQuery, params);
        return result.rows;
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (Semáforo + Cliente Efímero) ───
    await dbMutex.lock(); // 🚦 Solo pasa una petición a la vez

    try {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;

            const client = new pg.Client({
                connectionString: dbUrl,
                ssl: { rejectUnauthorized: false }, // 🟢 OBLIGATORIO para Supabase Pooler
                connectionTimeoutMillis: 10000,
                query_timeout: 15000
            });

            try {
                await client.connect();
                const result = await client.query(pgQuery, params);
                return result.rows;

            } catch (error) {
                const errMsg = error.message || '';
                if (errMsg.includes('terminated') || errMsg.includes('ECONNRESET') || errMsg.includes('closed')) {
                    if (attempts >= maxAttempts) throw error;
                    await new Promise(resolve => setTimeout(resolve, 300 * attempts));
                    continue;
                }
                throw error;

            } finally {
                await client.end().catch(() => { });
            }
        }
    } finally {
        dbMutex.unlock(); // 🚦 Libera el pase para la siguiente petición
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