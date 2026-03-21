// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos - CON SUPABASE CLIENT (VERSIÓN SIMPLIFICADA)
// ============================================================

let _pgPromise = null;
let _pool = null;
let _supabaseClient = null;
let _requestCounter = 0;

// Detectar Cloudflare Workers
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

        let supabaseUrl = c?.env?.SUPABASE_URL || process.env.SUPABASE_URL;
        let supabaseKey = c?.env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        console.log(`[DB-DEBUG] SUPABASE_URL exists: ${!!supabaseUrl}`);
        console.log(`[DB-DEBUG] SUPABASE_ANON_KEY exists: ${!!supabaseKey}`);

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
            }
        });
    }
    return _supabaseClient;
};

export const executeQuery = async (c, query, params = []) => {
    _requestCounter++;
    const requestId = _requestCounter;

    console.log(`\n[DB-DEBUG] ========== QUERY #${requestId} START ==========`);
    console.log(`[DB-DEBUG] Query: ${query.substring(0, 150)}...`);
    console.log(`[DB-DEBUG] Params count: ${params.length}`);

    const isCloudflare = isCloudflareWorker();
    console.log(`[DB-DEBUG] isCloudflare: ${isCloudflare}`);

    // ─── RUTA A: LOCAL / DOCKER / TESTS (pg.Pool) ───
    if (!isCloudflare) {
        const dbUrl = c?.env?.DATABASE_URL || process.env.DATABASE_URL;
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

        try {
            const result = await _pool.query(pgQuery, params);
            console.log(`[DB-DEBUG] ✅ Rows returned: ${result.rows.length}`);
            return result.rows;
        } catch (error) {
            console.error(`[DB-DEBUG] ❌ pg.Pool error:`, error.message);
            throw error;
        }
    }

    // ─── RUTA B: CLOUDFLARE WORKERS (Supabase Client Directo) ───
    console.log(`[DB-DEBUG] ☁️  Using Cloudflare path (Supabase Client Directo)`);

    try {
        const supabase = await getSupabaseClient(c);

        // Parsear la consulta SQL para extraer el nombre de la tabla/vista
        // Para SELECT * FROM vw_directory_employees
        const selectMatch = query.match(/SELECT\s+\*\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);

        if (selectMatch && selectMatch[1]) {
            const tableName = selectMatch[1];
            console.log(`[DB-DEBUG] Querying table/view: ${tableName}`);

            // Usar el cliente de Supabase directamente
            const { data, error } = await supabase
                .from(tableName)
                .select('*');

            if (error) {
                console.error(`[DB-DEBUG] ❌ Supabase error:`, error.message);
                console.error(`[DB-DEBUG] Error details:`, error);
                throw new Error(`Supabase query failed: ${error.message}`);
            }

            console.log(`[DB-DEBUG] ✅ Rows returned: ${data?.length || 0}`);
            return data || [];

        } else {
            // Para consultas más complejas, necesitamos RPC
            // Primero, verificar si la función existe
            console.log(`[DB-DEBUG] Complex query detected, attempting RPC...`);

            const { data, error } = await supabase.rpc('execute_sql', {
                sql_query: query,
                sql_params: params
            });

            if (error) {
                console.error(`[DB-DEBUG] ❌ RPC error:`, error.message);

                // Si la función no existe, mostrar mensaje claro
                if (error.message.includes('function execute_sql')) {
                    throw new Error(`The function "execute_sql" does not exist in Supabase. Please create it first.`);
                }
                throw error;
            }

            console.log(`[DB-DEBUG] ✅ RPC result:`, data);
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