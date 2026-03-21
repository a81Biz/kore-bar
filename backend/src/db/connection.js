// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Híbrido - Funciona en Local y Cloudflare
// ============================================================

let _pgPromise = null;
let _pool = null;
let _supabaseClient = null;
let _requestCounter = 0;

// Detectar Cloudflare Workers de forma confiable
const isCloudflareWorker = () => {
    const hasWorkerGlobals = typeof caches !== 'undefined' && typeof WebSocketPair !== 'undefined';
    if (!hasWorkerGlobals) return false;

    const hasBrowserGlobals = typeof window !== 'undefined' || typeof document !== 'undefined';
    const isRealNode = typeof process !== 'undefined' && process.versions && process.versions.node;

    return hasWorkerGlobals && !hasBrowserGlobals && !isRealNode;
};

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

// Función para convertir consulta SQL simple a Supabase format
const convertToSupabaseQuery = (query) => {
    // Normalizar query
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    // Patrón para SELECT simple (incluyendo WHERE y ORDER BY)
    const selectRegex = /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?$/i;
    const match = normalizedQuery.match(selectRegex);

    if (!match) {
        return null;
    }

    const [, fields, tableName, whereClause, orderByClause] = match;

    const result = {
        type: 'select',
        table: tableName,
        select: fields
    };

    // Parsear WHERE si existe
    if (whereClause) {
        const conditions = [];
        // Dividir por AND (soporte básico)
        const parts = whereClause.split(/\s+AND\s+/i);

        for (const part of parts) {
            // Manejar campo = valor
            const eqMatch = part.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:'([^']*)'|([^'\s]+))/i);
            if (eqMatch) {
                const field = eqMatch[1];
                const value = eqMatch[2] !== undefined ? eqMatch[2] : eqMatch[3];
                conditions.push({ field, operator: 'eq', value });
                continue;
            }

            // Manejar campo IS TRUE / FALSE
            const isMatch = part.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s+IS\s+(TRUE|FALSE)/i);
            if (isMatch) {
                conditions.push({ field: isMatch[1], operator: 'eq', value: isMatch[2] === 'TRUE' });
                continue;
            }
        }

        if (conditions.length > 0) {
            result.where = conditions;
        }
    }

    // Parsear ORDER BY si existe
    if (orderByClause) {
        const orderFields = orderByClause.split(',').map(f => f.trim());
        result.orderBy = orderFields.map(field => {
            const [fieldName, direction] = field.split(/\s+/);
            return {
                field: fieldName,
                ascending: !direction || direction.toUpperCase() !== 'DESC'
            };
        });
    }

    return result;
};

// Ejecutar consulta en Cloudflare con Supabase
const executeCloudflareQuery = async (supabase, query, params) => {
    // Intentar convertir a formato Supabase
    const supabaseQuery = convertToSupabaseQuery(query);

    if (!supabaseQuery) {
        // Si no se puede convertir, fallar con mensaje claro
        throw new Error(`Unsupported query in Cloudflare: ${query.substring(0, 100)}. Only simple SELECT statements are supported.`);
    }

    console.log(`[DB-DEBUG] Converting SQL to Supabase query on table: ${supabaseQuery.table}`);

    let dbQuery = supabase.from(supabaseQuery.table).select(supabaseQuery.select);

    // Aplicar WHERE
    if (supabaseQuery.where) {
        for (const condition of supabaseQuery.where) {
            dbQuery = dbQuery.eq(condition.field, condition.value);
        }
    }

    // Aplicar ORDER BY
    if (supabaseQuery.orderBy) {
        for (const order of supabaseQuery.orderBy) {
            dbQuery = dbQuery.order(order.field, { ascending: order.ascending });
        }
    }

    const { data, error } = await dbQuery;

    if (error) {
        throw error;
    }

    return data || [];
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
        const dbUrl = getDbUrl(c);
        if (!dbUrl) throw new Error('No database connection configuration found.');

        // Convertir ? a $1, $2, etc. para PostgreSQL
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

    // ─── RUTA B: CLOUDFLARE WORKERS (Supabase Client) ───
    console.log(`[DB-DEBUG] ☁️  Using Cloudflare path (Supabase Client)`);

    try {
        // Inicializar Supabase client si no existe
        if (!_supabaseClient) {
            const { createClient } = await import('@supabase/supabase-js');

            let supabaseUrl = c?.env?.SUPABASE_URL || process.env.SUPABASE_URL;
            let supabaseKey = c?.env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

            console.log(`[DB-DEBUG] SUPABASE_URL exists: ${!!supabaseUrl}`);
            console.log(`[DB-DEBUG] SUPABASE_ANON_KEY exists: ${!!supabaseKey}`);

            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Supabase credentials not configured in Cloudflare environment');
            }

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

        // Ejecutar consulta en Cloudflare
        const result = await executeCloudflareQuery(_supabaseClient, query, params);
        console.log(`[DB-DEBUG] ✅ Rows returned: ${result?.length || 0}`);
        return result;

    } catch (error) {
        console.error(`[DB-DEBUG] ❌ Cloudflare query error:`, error.message);
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