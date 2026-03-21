// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido CON LOGS DETALLADOS
// ============================================================

let _pgPromise = null;
let _postgresPromise = null;
let _pool = null;
let _requestCounter = 0;

// Detectar Cloudflare Workers de forma confiable
const isCloudflareWorker = () => {
    const isCF = typeof caches !== 'undefined' &&
        typeof WebSocketPair !== 'undefined' &&
        typeof navigator === 'undefined' &&
        typeof process === 'undefined';

    console.log(`[DB-DEBUG] isCloudflareWorker: ${isCF}`);
    console.log(`[DB-DEBUG] - caches: ${typeof caches !== 'undefined'}`);
    console.log(`[DB-DEBUG] - WebSocketPair: ${typeof WebSocketPair !== 'undefined'}`);
    console.log(`[DB-DEBUG] - navigator: ${typeof navigator}`);
    console.log(`[DB-DEBUG] - process: ${typeof process}`);

    return isCF;
};

const getDbUrl = (c) => {
    console.log(`[DB-DEBUG] getDbUrl called`);
    console.log(`[DB-DEBUG] c exists: ${!!c}`);
    console.log(`[DB-DEBUG] c.env exists: ${!!(c && c.env)}`);

    // Para Cloudflare Workers, usar el pooler de Supabase (puerto 6543)
    if (isCloudflareWorker() && c && c.env) {
        console.log(`[DB-DEBUG] Environment: Cloudflare detected`);

        if (c.env.DATABASE_URL_CLOUDFLARE) {
            console.log(`[DB-DEBUG] Using DATABASE_URL_CLOUDFLARE (masked)`);
            const url = c.env.DATABASE_URL_CLOUDFLARE;
            // Log parcial para no exponer credenciales completas
            const maskedUrl = url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
            console.log(`[DB-DEBUG] URL: ${maskedUrl}`);
            return url;
        }

        if (c.env.DATABASE_URL_POOLER) {
            console.log(`[DB-DEBUG] Using DATABASE_URL_POOLER (masked)`);
            const url = c.env.DATABASE_URL_POOLER;
            const maskedUrl = url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
            console.log(`[DB-DEBUG] URL: ${maskedUrl}`);
            return url;
        }

        if (c.env.DATABASE_URL) {
            console.log(`[DB-DEBUG] Using DATABASE_URL (masked) - WARNING: Should use pooler in Cloudflare`);
            const url = c.env.DATABASE_URL;
            const maskedUrl = url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
            console.log(`[DB-DEBUG] URL: ${maskedUrl}`);
            return url;
        }
    }

    // Para local o desarrollo
    if (c && c.env && c.env.DATABASE_URL) {
        console.log(`[DB-DEBUG] Using DATABASE_URL from c.env (masked)`);
        const url = c.env.DATABASE_URL;
        const maskedUrl = url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.log(`[DB-DEBUG] URL: ${maskedUrl}`);
        return url;
    }

    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
        console.log(`[DB-DEBUG] Using DATABASE_URL from process.env (masked)`);
        const url = process.env.DATABASE_URL;
        const maskedUrl = url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.log(`[DB-DEBUG] URL: ${maskedUrl}`);
        return url;
    }

    console.error(`[DB-DEBUG] ❌ No DATABASE_URL found!`);
    return null;
};

export const executeQuery = async (c, query, params = []) => {
    _requestCounter++;
    const requestId = _requestCounter;

    console.log(`\n[DB-DEBUG] ========== QUERY #${requestId} START ==========`);
    console.log(`[DB-DEBUG] Timestamp: ${new Date().toISOString()}`);
    console.log(`[DB-DEBUG] Query length: ${query.length}`);
    console.log(`[DB-DEBUG] Query preview: ${query.substring(0, 150)}...`);
    console.log(`[DB-DEBUG] Params count: ${params.length}`);
    console.log(`[DB-DEBUG] Params: ${JSON.stringify(params)}`);

    const dbUrl = getDbUrl(c);
    if (!dbUrl) {
        console.error(`[DB-DEBUG] ❌ No database URL found`);
        throw new Error('No database connection configuration found.');
    }

    // Convertir ? a $1, $2, etc.
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => {
        const replacement = `$${paramIndex++}`;
        console.log(`[DB-DEBUG] Replaced ? with ${replacement}`);
        return replacement;
    });

    console.log(`[DB-DEBUG] Converted query: ${pgQuery.substring(0, 150)}...`);

    const isCloudflare = isCloudflareWorker();
    const isLocalDb = !dbUrl.includes('supabase');

    console.log(`[DB-DEBUG] isCloudflare: ${isCloudflare}`);
    console.log(`[DB-DEBUG] isLocalDb: ${isLocalDb}`);
    console.log(`[DB-DEBUG] dbUrl includes supabase: ${dbUrl.includes('supabase')}`);
    console.log(`[DB-DEBUG] dbUrl includes pooler: ${dbUrl.includes('pooler')}`);
    console.log(`[DB-DEBUG] dbUrl port: ${dbUrl.match(/:([0-9]+)\//)?.[1] || 'default'}`);

    // ─── RUTA A: LOCAL / DOCKER / TESTS (CON POOL) ───
    if (!isCloudflare) {
        console.log(`[DB-DEBUG] 🖥️  Using LOCAL path (pg.Pool)`);

        try {
            if (!_pgPromise) {
                console.log(`[DB-DEBUG] Loading pg module...`);
                _pgPromise = import('pg').then(m => m.default || m);
            }
            const pg = await _pgPromise;
            console.log(`[DB-DEBUG] pg module loaded`);

            if (!_pool) {
                console.log(`[DB-DEBUG] Creating new pg.Pool...`);
                _pool = new pg.Pool({
                    connectionString: dbUrl,
                    max: 15,
                    ssl: isLocalDb ? false : { rejectUnauthorized: false }
                });
                console.log(`[DB-DEBUG] Pool created`);
            }

            console.log(`[DB-DEBUG] Executing query via pool...`);
            const startTime = Date.now();
            const result = await _pool.query(pgQuery, params);
            const duration = Date.now() - startTime;

            console.log(`[DB-DEBUG] ✅ Query SUCCESS in ${duration}ms`);
            console.log(`[DB-DEBUG] Rows returned: ${result.rows.length}`);
            console.log(`[DB-DEBUG] ========== QUERY #${requestId} END ==========\n`);

            return result.rows;

        } catch (error) {
            console.error(`[DB-DEBUG] ❌ Local query FAILED:`, error.message);
            console.error(`[DB-DEBUG] Error stack:`, error.stack);
            console.log(`[DB-DEBUG] ========== QUERY #${requestId} END (ERROR) ==========\n`);
            throw error;
        }
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (SIN POOL - CONEXIÓN EFÍMERA) ───
    console.log(`[DB-DEBUG] ☁️  Using CLOUDFLARE path (postgres.js ephemeral)`);

    if (!_postgresPromise) {
        console.log(`[DB-DEBUG] Loading postgres module...`);
        _postgresPromise = import('postgres').then(m => m.default || m);
    }
    const postgres = await _postgresPromise;
    console.log(`[DB-DEBUG] postgres module loaded`);

    // Configuración para Cloudflare: SIN POOL, conexión efímera
    const sqlOptions = {
        ssl: 'require',
        max: 1,
        idle_timeout: 0,
        connect_timeout: 10,
        timeout: 30000,
        prepare: false,
        onnotice: () => console.log(`[DB-DEBUG] Postgres notice received`),
        connection: {
            attempts: 1
        }
    };

    console.log(`[DB-DEBUG] postgres.js options:`, JSON.stringify(sqlOptions, null, 2));

    let sql = null;

    try {
        console.log(`[DB-DEBUG] Creating postgres.js connection...`);
        const startTime = Date.now();

        sql = postgres(dbUrl, sqlOptions);
        console.log(`[DB-DEBUG] Connection created, executing unsafe query...`);

        const result = await sql.unsafe(pgQuery, params);
        const duration = Date.now() - startTime;

        console.log(`[DB-DEBUG] ✅ Cloudflare query SUCCESS in ${duration}ms`);
        console.log(`[DB-DEBUG] Result type: ${typeof result}`);
        console.log(`[DB-DEBUG] Is array: ${Array.isArray(result)}`);

        const rows = Array.isArray(result) ? result : (result ? [result] : []);
        console.log(`[DB-DEBUG] Rows returned: ${rows.length}`);

        return rows;

    } catch (error) {
        console.error(`[DB-DEBUG] ❌ Cloudflare query FAILED:`, error.message);
        console.error(`[DB-DEBUG] Error name:`, error.name);
        console.error(`[DB-DEBUG] Error stack:`, error.stack);

        // Log específico del error de pool
        if (error.message && error.message.includes('subscribers for pool')) {
            console.error(`[DB-DEBUG] 🔴 POOL ERROR DETECTED: This is a postgres.js pool shutdown issue`);
            console.error(`[DB-DEBUG] 🔴 This happens when postgres.js tries to maintain persistent connections in Cloudflare`);
        }

        throw error;

    } finally {
        if (sql) {
            console.log(`[DB-DEBUG] Closing postgres.js connection...`);
            try {
                await sql.end({ timeout: 5 });
                console.log(`[DB-DEBUG] Connection closed successfully`);
            } catch (e) {
                console.error(`[DB-DEBUG] Error closing connection:`, e.message);
            }
        }
        console.log(`[DB-DEBUG] ========== QUERY #${requestId} END ==========\n`);
    }
};

export const executeStoredProcedure = async (c, procedureName, params = {}, types = {}) => {
    console.log(`[DB-DEBUG] executeStoredProcedure called: ${procedureName}`);
    console.log(`[DB-DEBUG] Params:`, JSON.stringify(params));
    console.log(`[DB-DEBUG] Types:`, JSON.stringify(types));

    const entries = Object.entries(params);
    const values = entries.map(([_, v]) => v);
    const placeholders = entries.map(([key, _], index) => {
        const cast = types[key];
        return cast ? `$${index + 1}::${cast}` : `$${index + 1}`;
    }).join(', ');

    const query = `CALL ${procedureName}(${placeholders});`;
    console.log(`[DB-DEBUG] Stored procedure query: ${query}`);

    return await executeQuery(c, query, values);
};