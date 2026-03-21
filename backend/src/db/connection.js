// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido
// Local/Tests -> Usa Pool (Velocidad y concurrencia)
// Cloudflare  -> Usa Cliente Efímero Estricto (Evita "Hung Errors")
// ============================================================

let _pgModule = null; // Caché del import para velocidad
let _pool = null;     // Singleton Pool SOLO para entorno local

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

    // Importación dinámica segura
    if (!_pgModule) {
        _pgModule = await import('pg');
    }
    const pg = _pgModule.default;

    const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('@db');
    // Detectamos si estamos en Cloudflare Workers (Edge)
    const isCloudflare = typeof WebSocketPair !== 'undefined';

    // ─── RUTA A: LOCAL / DOCKER / TESTS (Pool) ───
    if (!isCloudflare) {
        if (!_pool) {
            _pool = new pg.Pool({
                connectionString: dbUrl,
                max: 15, // Perfecto para tests en paralelo
                idleTimeoutMillis: 30000,
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }
        try {
            const result = await _pool.query(pgQuery, params);
            return result.rows;
        } catch (error) {
            console.error('Local PostgreSQL Query Error:', error);
            throw error;
        }
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (Cliente Efímero Estricto) ───
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

            // Reintento silencioso si hay micro-cortes
            if (errMsg.includes('terminated unexpectedly') || errMsg.includes('ECONNRESET') || errMsg.includes('Client was closed')) {
                if (attempts >= maxAttempts) throw error;
                await new Promise(resolve => setTimeout(resolve, 200 * attempts));
                continue;
            }

            console.error('Cloudflare PostgreSQL Query Error:', error);
            throw error;

        } finally {
            // CRÍTICO para Cloudflare: Destruye el socket para evitar el "Hung Code"
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