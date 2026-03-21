// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido - Optimizado para Cloudflare
// ============================================================

let _pgPromise = null;
let _postgresPromise = null;
let _pool = null;
let _sql = null;
let _isCloudflare = null;

// Detectar Cloudflare Workers de forma confiable
const isCloudflareWorker = () => {
    if (_isCloudflare !== null) return _isCloudflare;
    // Características únicas de Cloudflare Workers
    _isCloudflare = typeof caches !== 'undefined' &&
        typeof WebSocketPair !== 'undefined' &&
        typeof navigator === 'undefined';
    return _isCloudflare;
};

const getDbUrl = (c) => {
    // Priorizar DATABASE_URL_POOLER para Cloudflare
    if (isCloudflareWorker() && c && c.env && c.env.DATABASE_URL_POOLER) {
        return c.env.DATABASE_URL_POOLER;
    }
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found.');

    // Convertir ? a $1, $2, etc.
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    const isCloudflare = isCloudflareWorker();
    const isLocalDb = !dbUrl.includes('supabase');

    // ─── RUTA A: LOCAL / DOCKER / TESTS ───
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

    // ─── RUTA B: CLOUDFLARE WORKERS (Configuración OPTIMIZADA) ───
    // IMPORTANTE: En Cloudflare NO se mantienen conexiones persistentes
    // Cada consulta debe ser independiente

    if (!_postgresPromise) _postgresPromise = import('postgres').then(m => m.default || m);
    const postgres = await _postgresPromise;

    // 🔑 CLAVE: Crear cliente NUEVO para cada consulta
    // O reutilizar uno con max=1 para evitar múltiples subrequests
    const sql = postgres(dbUrl, {
        ssl: 'require',
        max: 1,              // ← CRÍTICO: Solo 1 conexión por worker
        idle_timeout: 0,     // ← Cerrar inmediatamente después de usar
        connect_timeout: 5,
        timeout: 30000,
        prepare: false,      // ← Deshabilitar prepared statements
        debug: false,
        // Evitar consultas internas adicionales
        onnotice: () => { },
        onparameter: () => { },
        types: []
    });

    try {
        // Ejecutar consulta
        const result = await sql.unsafe(pgQuery, params);

        // Cerrar conexión inmediatamente (libera el subrequest)
        await sql.end().catch(() => { });

        return Array.isArray(result) ? result : (result ? [result] : []);

    } catch (error) {
        console.error('[DB] Cloudflare Error:', error.message);
        // Asegurar cierre
        await sql.end().catch(() => { });
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