// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos - CON SUPABASE CLIENT (OPTIMIZADO)
// ============================================================

let _pgPromise = null;
let _pool = null;
let _supabaseClient = null;
let _requestCounter = 0;

// Detectar Cloudflare Workers CORRECTAMENTE
const isCloudflareWorker = () => {
    const hasWorkerGlobals = typeof caches !== 'undefined' && typeof WebSocketPair !== 'undefined';
    if (!hasWorkerGlobals) return false;

    const hasBrowserGlobals = typeof window !== 'undefined' || typeof document !== 'undefined';
    const isRealNode = typeof process !== 'undefined' && process.versions && process.versions.node;

    return hasWorkerGlobals && !hasBrowserGlobals && !isRealNode;
};

const getSupabaseClient = async (c) => {
    if (!_supabaseClient) {
        const { createClient } = await import('@supabase/supabase-js');

        const supabaseUrl = c?.env?.SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = c?.env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not configured');
        }

        console.log(`[DB-DEBUG] Creating Supabase client for Cloudflare`);

        _supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            },
            global: {
                headers: {
                    'X-Application-Name': 'kore-bar-worker'
                }
            },
            // Configuración para Cloudflare
            db: {
                schema: 'public'
            }
        });
    }
    return _supabaseClient;
};

const getDbUrl = (c) => {
    if (isCloudflareWorker() && c && c.env) {
        if (c.env.DATABASE_URL_POOLER) return c.env.DATABASE_URL_POOLER;
        if (c.env.DATABASE_URL) return c.env.DATABASE_URL;
    }

    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;

    return null;
};

export const executeQuery = async (c, query, params = []) => {
    _requestCounter++;
    const requestId = _requestCounter;

    console.log(`\n[DB-DEBUG] ========== QUERY #${requestId} START ==========`);
    console.log(`[DB-DEBUG] Query preview: ${query.substring(0, 100)}...`);
    console.log(`[DB-DEBUG] Params count: ${params.length}`);

    const isCloudflare = isCloudflareWorker();
    console.log(`[DB-DEBUG] isCloudflare: ${isCloudflare}`);

    // ─── RUTA A: LOCAL / DOCKER / TESTS (pg.Pool) ───
    if (!isCloudflare) {
        const dbUrl = getDbUrl(c);
        if (!dbUrl) throw new Error('No database connection configuration found.');

        // Convertir ? a $1, $2, etc.
        let pgQuery = query;
        let paramIndex = 1;
        pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

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

    // ─── RUTA B: CLOUDFLARE WORKERS (Supabase Client) ───
    console.log(`[DB-DEBUG] ☁️  Using Cloudflare path (Supabase Client)`);

    try {
        const supabase = await getSupabaseClient(c);

        // Detectar si es un SELECT o un CALL (stored procedure)
        const isSelect = query.trim().toUpperCase().startsWith('SELECT');
        const isCall = query.trim().toUpperCase().startsWith('CALL');

        if (isSelect) {
            // Para SELECT, usar .rpc con una función de SQL
            // Primero, necesitamos una función en Supabase para ejecutar SQL
            // Alternativa: usar el cliente REST de Supabase
            console.log(`[DB-DEBUG] Executing SELECT via Supabase.rpc('execute_sql')`);

            // Usar RPC para ejecutar SQL (necesitas crear esta función en Supabase)
            const { data, error } = await supabase.rpc('execute_sql', {
                query_text: query,
                query_params: params
            });

            if (error) {
                console.error(`[DB-DEBUG] ❌ Supabase RPC error:`, error);
                throw error;
            }

            console.log(`[DB-DEBUG] ✅ Rows returned: ${data?.length || 0}`);
            return data || [];

        } else if (isCall) {
            // Para CALL (stored procedures), también usar RPC
            console.log(`[DB-DEBUG] Executing CALL via Supabase.rpc('execute_sql')`);

            const { data, error } = await supabase.rpc('execute_sql', {
                query_text: query,
                query_params: params
            });

            if (error) throw error;
            return data || [];

        } else {
            // Para otros tipos de queries
            console.log(`[DB-DEBUG] Executing via Supabase.rpc('execute_sql')`);

            const { data, error } = await supabase.rpc('execute_sql', {
                query_text: query,
                query_params: params
            });

            if (error) throw error;
            return data || [];
        }

    } catch (error) {
        console.error(`[DB-DEBUG] ❌ Supabase error:`, error.message);
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