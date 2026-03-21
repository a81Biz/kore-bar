// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido - CON DETECCIÓN CORREGIDA
// ============================================================

let _pgPromise = null;
let _postgresPromise = null;
let _pool = null;
let _requestCounter = 0;

// 🔑 Detectar Cloudflare Workers CORRECTAMENTE incluso con nodejs_compat
const isCloudflareWorker = () => {
    // Método #1: Verificar si estamos en un entorno Worker por la presencia de caches y WebSocketPair
    // Y además, si el script se ejecuta desde un Worker (no desde un navegador)
    const hasWorkerGlobals = typeof caches !== 'undefined' && typeof WebSocketPair !== 'undefined';

    if (!hasWorkerGlobals) {
        return false;
    }

    // Método #2: En Workers, incluso con nodejs_compat, existe una variable global 'navigator'
    // pero NO existe 'window' ni 'document'. En Node.js puro, 'navigator' no existe.
    const hasBrowserGlobals = typeof window !== 'undefined' || typeof document !== 'undefined';

    // Método #3: En Workers con nodejs_compat, 'process' existe pero NO tiene 'process.versions.node'
    // En Node.js real, 'process.versions.node' existe y contiene la versión
    const isRealNode = typeof process !== 'undefined' && process.versions && process.versions.node;

    // Si tiene worker globals, NO tiene browser globals, y NO es Node.js real → es Cloudflare Worker
    const isCloudflare = hasWorkerGlobals && !hasBrowserGlobals && !isRealNode;

    console.log(`[DB-DEBUG] Detección Cloudflare:`);
    console.log(`[DB-DEBUG]   hasWorkerGlobals: ${hasWorkerGlobals}`);
    console.log(`[DB-DEBUG]   hasBrowserGlobals: ${hasBrowserGlobals}`);
    console.log(`[DB-DEBUG]   isRealNode: ${isRealNode}`);
    console.log(`[DB-DEBUG]   result: ${isCloudflare}`);

    return isCloudflare;
};

const getDbUrl = (c) => {
    // Para Cloudflare Workers
    if (isCloudflareWorker() && c && c.env) {
        // Usar el pooler de Supabase (puerto 6543) OBLIGATORIO en Workers
        if (c.env.DATABASE_URL_POOLER) {
            console.log(`[DB-DEBUG] Using DATABASE_URL_POOLER for Cloudflare`);
            return c.env.DATABASE_URL_POOLER;
        }
        if (c.env.DATABASE_URL) {
            console.log(`[DB-DEBUG] Using DATABASE_URL for Cloudflare`);
            return c.env.DATABASE_URL;
        }
    }

    // Para local o desarrollo (Node.js)
    if (c && c.env && c.env.DATABASE_URL) {
        console.log(`[DB-DEBUG] Using DATABASE_URL from c.env for Node.js`);
        return c.env.DATABASE_URL;
    }

    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
        console.log(`[DB-DEBUG] Using DATABASE_URL from process.env for Node.js`);
        return process.env.DATABASE_URL;
    }

    return null;
};

export const executeQuery = async (c, query, params = []) => {
    _requestCounter++;
    const requestId = _requestCounter;

    console.log(`\n[DB-DEBUG] ========== QUERY #${requestId} START ==========`);
    console.log(`[DB-DEBUG] Timestamp: ${new Date().toISOString()}`);
    console.log(`[DB-DEBUG] Query preview: ${query.substring(0, 100)}...`);
    console.log(`[DB-DEBUG] Params count: ${params.length}`);

    const dbUrl = getDbUrl(c);
    if (!dbUrl) {
        throw new Error('No database connection configuration found.');
    }

    // Convertir ? a $1, $2, etc.
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    const isCloudflare = isCloudflareWorker();

    console.log(`[DB-DEBUG] isCloudflare FINAL: ${isCloudflare}`);
    console.log(`[DB-DEBUG] dbUrl port: ${dbUrl.match(/:([0-9]+)\//)?.[1] || 'default'}`);

    // ─── RUTA A: NODE.JS (LOCAL / DOCKER / TESTS) ───
    if (!isCloudflare) {
        console.log(`[DB-DEBUG] 🖥️  Using Node.js path (pg.Pool)`);

        if (!_pgPromise) {
            _pgPromise = import('pg').then(m => m.default || m);
        }
        const pg = await _pgPromise;

        if (!_pool) {
            const isLocalDb = !dbUrl.includes('supabase');
            console.log(`[DB-DEBUG] Creating pg.Pool, isLocalDb: ${isLocalDb}`);
            _pool = new pg.Pool({
                connectionString: dbUrl,
                max: 15,
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }

        try {
            const result = await _pool.query(pgQuery, params);
            console.log(`[DB-DEBUG] ✅ Rows returned: ${result.rows.length}`);
            return result.rows;
        } catch (error) {
            console.error(`[DB-DEBUG] ❌ pg.Pool error:`, error.message);
            throw error;
        }
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (postgres.js) ───
    console.log(`[DB-DEBUG] ☁️  Using Cloudflare path (postgres.js)`);

    if (!_postgresPromise) {
        _postgresPromise = import('postgres').then(m => m.default || m);
    }
    const postgres = await _postgresPromise;

    // Configuración OPTIMIZADA para Cloudflare
    const sqlOptions = {
        ssl: 'require',
        max: 1,
        idle_timeout: 0,
        connect_timeout: 10,
        timeout: 30000,
        prepare: false,
        onnotice: () => { },
    };

    console.log(`[DB-DEBUG] Creating postgres.js connection with options:`, sqlOptions);

    const sql = postgres(dbUrl, sqlOptions);

    try {
        console.log(`[DB-DEBUG] Executing unsafe query...`);
        const result = await sql.unsafe(pgQuery, params);
        const rows = Array.isArray(result) ? result : (result ? [result] : []);
        console.log(`[DB-DEBUG] ✅ Rows returned: ${rows.length}`);
        return rows;

    } catch (error) {
        console.error(`[DB-DEBUG] ❌ postgres.js error:`, error.message);
        throw error;

    } finally {
        console.log(`[DB-DEBUG] Closing connection...`);
        await sql.end({ timeout: 5 }).catch(e => console.error(`[DB-DEBUG] Error closing:`, e.message));
        console.log(`[DB-DEBUG] Connection closed`);
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