// src/db/connection.js
let _pgPromise = null;

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

// Detectar si estamos en Cloudflare Workers
const isCloudflareWorker = () => {
    // Método confiable: verificar existencia de c.env (típico de Workers)
    // o verificar que no hay process (los workers no tienen process global)
    return typeof process === 'undefined' && typeof window === 'undefined';
};

const getPg = async () => {
    if (!_pgPromise) {
        _pgPromise = import('pg').then(m => m.default || m);
    }
    return await _pgPromise;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found. Set DATABASE_URL.');

    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    const pg = await getPg();
    const isCloudflare = isCloudflareWorker();

    // ─── RUTA A: LOCAL / DOCKER / TESTS ───
    if (!isCloudflare) {
        // Solo mantener un pool en desarrollo local
        if (!global._pgPool) {
            const isLocalDb = !dbUrl.includes('supabase');
            global._pgPool = new pg.Pool({
                connectionString: dbUrl,
                max: 15,
                // Para Supabase desde local, necesitas SSL pero con opciones específicas
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            });
        }
        const result = await global._pgPool.query(pgQuery, params);
        return result.rows;
    }

    // ─── RUTA B: CLOUDFLARE WORKERS ───
    // IMPORTANTE: En Workers, usamos el pooler de Supabase y configuramos SSL correctamente

    // Verificar que usamos la URL con pooler (port 6543) y no la directa (port 5432)
    let connectionUrl = dbUrl;

    // Si es Supabase y no está usando el pooler, sugerir cambio
    if (dbUrl.includes('supabase') && !dbUrl.includes(':6543')) {
        console.warn('[DB] Sugerencia: Usa el pooler de Supabase (puerto 6543) para Cloudflare Workers');
        // Convertir automáticamente a pooler si es necesario
        connectionUrl = dbUrl.replace(':5432', ':6543');
    }

    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts) {
        attempts++;

        // Para Cloudflare Workers, necesitamos configuración SSL específica
        const client = new pg.Client({
            connectionString: connectionUrl,
            connectionTimeoutMillis: 15000,
            query_timeout: 20000,
            // Configuración SSL específica para Supabase + Cloudflare
            ssl: {
                rejectUnauthorized: false,  // Necesario para Workers
                ca: undefined,               // Dejar que maneje la CA automáticamente
                // Para Supabase, a veces necesita estas opciones
                checkServerIdentity: () => undefined
            }
        });

        try {
            await client.connect();
            console.log(`[DB] Connected successfully (attempt ${attempts})`);

            const result = await client.query(pgQuery, params);
            return result.rows;

        } catch (error) {
            lastError = error;
            const errMsg = error.message || '';
            console.error(`[DB] Attempt ${attempts} failed:`, errMsg);

            // Errores recuperables
            if (errMsg.includes('terminated unexpectedly') ||
                errMsg.includes('ECONNRESET') ||
                errMsg.includes('closed') ||
                errMsg.includes('timeout')) {

                if (attempts >= maxAttempts) break;

                // Backoff exponencial
                const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // Errores no recuperables
            throw error;
        } finally {
            // Importante: cerrar la conexión siempre
            await client.end().catch(e => console.error('[DB] Error closing:', e));
        }
    }

    throw new Error(`[DB] Failed after ${maxAttempts} attempts. Last error: ${lastError?.message || 'Unknown'}`);
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