// src/db/connection.js
// ============================================================
// Adaptador Híbrido: pg (Local TCP) + Supabase Proxy (Cloudflare REST)
// ============================================================

let _pgPromise = null;
let _pool = null;
let _supabaseClient = null;

// Detectar Cloudflare Workers vs Node (Docker)
const isCloudflareWorker = () => {
    const hasWorkerGlobals = typeof caches !== 'undefined' && typeof WebSocketPair !== 'undefined';
    const hasBrowserGlobals = typeof window !== 'undefined' || typeof document !== 'undefined';
    const isRealNode = typeof process !== 'undefined' && process.versions && process.versions.node;
    return hasWorkerGlobals && !hasBrowserGlobals && !isRealNode;
};

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

// ============================================================
// INTERPOLADOR SEGURO (Solo usado por Cloudflare)
// Reemplaza $1, $2 con los valores reales para enviar el SQL crudo
// ============================================================
const interpolateQuery = (query, params) => {
    if (!params || params.length === 0) return query;
    let interpolated = query;

    params.forEach((param, index) => {
        // Busca $1, $2, etc., asegurando que no confunda $1 con $10
        const token = new RegExp(`\\$${index + 1}(?!\\d)`, 'g');
        let valueStr;

        if (param === null || param === undefined) {
            valueStr = 'NULL';
        } else if (typeof param === 'number' || typeof param === 'boolean') {
            valueStr = String(param);
        } else if (typeof param === 'object') {
            const escaped = JSON.stringify(param).replace(/'/g, "''");
            valueStr = `'${escaped}'::jsonb`;
        } else {
            // Escapar comillas simples para evitar inyección SQL
            const escaped = String(param).replace(/'/g, "''");
            valueStr = `'${escaped}'`;
        }

        interpolated = interpolated.replace(token, valueStr);
    });

    return interpolated;
};

// ============================================================
// EJECUTOR PRINCIPAL (El Enrutador)
// ============================================================
export const executeQuery = async (c, query, params = []) => {
    const isCloudflare = isCloudflareWorker();

    // ─── RUTA A: LOCAL / DOCKER / TESTS (Usa librería pg pura) ───
    if (!isCloudflare) {
        const dbUrl = getDbUrl(c);
        if (!dbUrl) throw new Error('No database connection configuration found.');

        let pgQuery = query;
        let paramIndex = 1;
        // Transforma posibles "?" a "$1, $2" si existe algún caso
        pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

        if (!_pgPromise) _pgPromise = import('pg').then(m => m.default || m);
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
        return result.rows;
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (Usa Supabase Proxy REST) ───
    if (!_supabaseClient) {
        const { createClient } = await import('@supabase/supabase-js');
        let supabaseUrl = c?.env?.SUPABASE_URL || process.env.SUPABASE_URL;
        let supabaseKey = c?.env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Credenciales de Supabase no configuradas.');
        }

        _supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
    }

    // 1. Limpiamos y reemplazamos los parámetros ($1, $2) en el string
    let finalQuery = query;
    let paramIdx = 1;
    finalQuery = finalQuery.replace(/\?/g, () => `$${paramIdx++}`);
    finalQuery = interpolateQuery(finalQuery, params);

    // 2. Enviamos el SQL crudo a nuestra función Proxy
    const { data, error } = await _supabaseClient.rpc('kore_exec_sql', {
        query_string: finalQuery
    });

    if (error) {
        console.error(`[DB Cloudflare Error] Query: ${finalQuery.substring(0, 100)}...`);
        console.error(error.message);
        throw error;
    }

    return data || [];
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