// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido - DETECCIÓN CORREGIDA
// ============================================================

let _pgPromise = null;
let _postgresPromise = null;
let _pool = null;
let _requestCounter = 0;

// Detectar Cloudflare Workers de forma CORRECTA
const isCloudflareWorker = () => {
    // 🔑 Método CORRECTO para detectar Cloudflare Workers
    // En Cloudflare Workers NO existe process ni navigator

    // Si estamos en Node.js (local, tests, etc.)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        return false;
    }

    // Si estamos en un navegador
    if (typeof window !== 'undefined') {
        return false;
    }

    // Si estamos en Cloudflare Workers
    // Características únicas de Workers
    if (typeof caches !== 'undefined' && typeof WebSocketPair !== 'undefined') {
        // Verificar que NO es Node.js con nodejs_compat
        // En Workers con nodejs_compat, process existe pero es limitado
        // La presencia de caches y WebSocketPair sin navigator es clave
        if (typeof navigator === 'undefined') {
            return true;
        }
    }

    return false;
};

const getDbUrl = (c) => {
    // Para Cloudflare Workers
    if (isCloudflareWorker() && c && c.env) {
        // Usar el pooler de Supabase (puerto 6543) OBLIGATORIO en Workers
        if (c.env.DATABASE_URL_POOLER) {
            return c.env.DATABASE_URL_POOLER;
        }
        if (c.env.DATABASE_URL) {
            // Si solo hay DATABASE_URL, asegurarse que usa pooler
            const url = c.env.DATABASE_URL;
            if (!url.includes('pooler') && !url.includes(':6543')) {
                console.warn('[DB] ⚠️ WARNING: Using direct connection in Cloudflare. Use pooler (port 6543) for better performance');
            }
            return url;
        }
    }

    // Para local o desarrollo (Node.js)
    if (c && c.env && c.env.DATABASE_URL) {
        return c.env.DATABASE_URL;
    }

    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
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

    console.log(`[DB-DEBUG] isCloudflare: ${isCloudflare}`);
    console.log(`[DB-DEBUG] has process: ${typeof process !== 'undefined'}`);
    console.log(`[DB-DEBUG] has navigator: ${typeof navigator !== 'undefined'}`);
    console.log(`[DB-DEBUG] has caches: ${typeof caches !== 'undefined'}`);
    console.log(`[DB-DEBUG] has WebSocketPair: ${typeof WebSocketPair !== 'undefined'}`);
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
            _pool = new pg.Pool({
                connectionString: dbUrl,
                max: 15,
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }

        const result = await _pool.query(pgQuery, params);
        console.log(`[DB-DEBUG] ✅ Rows returned: ${result.rows.length}`);
        return result.rows;
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (postgres.js) ───
    console.log(`[DB-DEBUG] ☁️  Using Cloudflare path (postgres.js)`);

    if (!_postgresPromise) {
        _postgresPromise = import('postgres').then(m => m.default || m);
    }
    const postgres = await _postgresPromise;

    // Configuración OPTIMIZADA para Cloudflare
    const sql = postgres(dbUrl, {
        ssl: 'require',
        max: 1,                    // Una conexión por consulta
        idle_timeout: 0,           // No mantener conexiones
        connect_timeout: 10,
        timeout: 30000,
        prepare: false,            // No usar prepared statements
        onnotice: () => { },
        connection: {
            attempts: 1
        }
    });

    try {
        const result = await sql.unsafe(pgQuery, params);
        const rows = Array.isArray(result) ? result : (result ? [result] : []);
        console.log(`[DB-DEBUG] ✅ Rows returned: ${rows.length}`);
        return rows;

    } finally {
        await sql.end({ timeout: 5 }).catch(() => { });
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