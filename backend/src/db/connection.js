// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos - CON PARSER MEJORADO PARA JOINs
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

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

// Limpiar query (remover saltos de línea y múltiples espacios)
const cleanQuery = (query) => {
    return query.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
};

// Extraer alias de un campo (formato: campo AS "alias" o campo AS alias)
const extractAlias = (field) => {
    const aliasMatch = field.match(/(.+?)\s+AS\s+["']?([^"'\s]+)["']?$/i);
    if (aliasMatch) {
        return {
            field: aliasMatch[1].trim(),
            alias: aliasMatch[2].trim()
        };
    }
    return { field: field.trim(), alias: null };
};

// Convertir consulta con JOIN a formato Supabase
const convertJoinQuery = (query) => {
    const cleaned = cleanQuery(query);

    // Patrón para SELECT con JOIN
    // Ejemplo: SELECT t.code AS "tableId", z.code AS "zoneCode" FROM restaurant_tables t JOIN restaurant_zones z ON t.zone_id = z.id WHERE ...
    const joinRegex = /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+ON\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?$/i;
    const match = cleaned.match(joinRegex);

    if (!match) {
        return null;
    }

    const [, fields, table1, alias1, table2, alias2, onClause, whereClause, orderByClause] = match;

    console.log(`[DB-DEBUG] JOIN query detected:`);
    console.log(`[DB-DEBUG]   Tables: ${table1} (${alias1}) JOIN ${table2} (${alias2})`);

    // Parsear campos seleccionados
    const selectFields = fields.split(',').map(f => f.trim());
    const parsedFields = selectFields.map(f => extractAlias(f));

    // Construir la consulta de Supabase
    // Para JOINs, necesitamos usar la tabla principal y luego expandir con relaciones
    // En Supabase, podemos hacer .select('*, relacion(*, ...)')

    let selectStr = '*';

    // Si tenemos alias específicos, construir select con relaciones
    if (table2) {
        // Determinar la relación basada en ON clause
        const onMatch = onClause.match(/(?:(\w+)\.(\w+))\s*=\s*(?:(\w+)\.(\w+))/i);
        if (onMatch) {
            const [, leftTable, leftField, rightTable, rightField] = onMatch;

            // Mapear alias a tablas reales
            const leftTableName = leftTable === alias1 ? table1 : (leftTable === alias2 ? table2 : leftTable);
            const rightTableName = rightTable === alias1 ? table1 : (rightTable === alias2 ? table2 : rightTable);

            console.log(`[DB-DEBUG]   Relation: ${leftTableName}.${leftField} = ${rightTableName}.${rightField}`);

            // Construir select con la relación
            selectStr = `*, ${rightTableName}(*)`;
        }
    }

    const result = {
        type: 'select',
        table: table1,
        select: selectStr,
        relations: [{ table: table2, on: onClause }]
    };

    // Parsear WHERE si existe
    if (whereClause) {
        const conditions = [];
        const whereParts = whereClause.split(/\s+AND\s+/i);

        for (const part of whereParts) {
            // Manejar campo con alias = valor
            const eqMatch = part.match(/(?:(\w+)\.)?(\w+)\s*=\s*'?([^']*)'?/i);
            if (eqMatch) {
                const [, tableAlias, field, value] = eqMatch;
                conditions.push({ field, value, table: tableAlias });
            }

            // Manejar IS TRUE/FALSE
            const isMatch = part.match(/(?:(\w+)\.)?(\w+)\s+IS\s+(TRUE|FALSE)/i);
            if (isMatch) {
                const [, tableAlias, field, boolValue] = isMatch;
                conditions.push({ field, value: boolValue === 'TRUE', table: tableAlias });
            }
        }

        if (conditions.length > 0) {
            result.where = conditions;
        }
    }

    // Parsear ORDER BY
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

// Convertir consulta SQL simple a formato Supabase
const convertSimpleQuery = (query) => {
    const cleaned = cleanQuery(query);

    // Patrón para SELECT simple (sin JOIN)
    const simpleRegex = /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?$/i;
    const match = cleaned.match(simpleRegex);

    if (!match) {
        return null;
    }

    const [, fields, tableName, whereClause, orderByClause] = match;

    // Procesar campos (limpiar comillas dobles y alias)
    let processedFields = fields;
    // Remover comillas dobles de los alias
    processedFields = processedFields.replace(/"([^"]+)"/g, '$1');
    // Limpiar espacios
    processedFields = processedFields.replace(/\s+/g, ' ').trim();

    const result = {
        type: 'select',
        table: tableName,
        select: processedFields
    };

    // Parsear WHERE
    if (whereClause) {
        const conditions = [];
        const whereParts = whereClause.split(/\s+AND\s+/i);

        for (const part of whereParts) {
            // Manejar campo = valor
            const eqMatch = part.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*'?([^']*)'?/i);
            if (eqMatch) {
                conditions.push({ field: eqMatch[1], operator: 'eq', value: eqMatch[2] });
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

    // Parsear ORDER BY
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
    // Primero intentar como JOIN query
    let parsedQuery = convertJoinQuery(query);

    // Si no es JOIN, intentar como simple
    if (!parsedQuery) {
        parsedQuery = convertSimpleQuery(query);
    }

    if (!parsedQuery) {
        throw new Error(`Unsupported query in Cloudflare: ${query.substring(0, 100)}. Only SELECT with optional JOIN, WHERE and ORDER BY are supported.`);
    }

    console.log(`[DB-DEBUG] Converting SQL to Supabase query on table: ${parsedQuery.table}`);

    let dbQuery = supabase.from(parsedQuery.table).select(parsedQuery.select);

    // Aplicar WHERE
    if (parsedQuery.where) {
        for (const condition of parsedQuery.where) {
            dbQuery = dbQuery.eq(condition.field, condition.value);
        }
    }

    // Aplicar ORDER BY
    if (parsedQuery.orderBy) {
        for (const order of parsedQuery.orderBy) {
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
    console.log(`[DB-DEBUG] Query: ${query.substring(0, 200)}...`);
    console.log(`[DB-DEBUG] Params count: ${params.length}`);

    const isCloudflare = isCloudflareWorker();
    console.log(`[DB-DEBUG] isCloudflare: ${isCloudflare}`);

    // ─── RUTA A: LOCAL / DOCKER / TESTS (pg.Pool) ───
    if (!isCloudflare) {
        const dbUrl = getDbUrl(c);
        if (!dbUrl) throw new Error('No database connection configuration found.');

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