// src/db/connection.js
// ============================================================
// Adaptador Unificado de Base de Datos con Auto-Sanación (Self-Healing)
// ============================================================

let _pool = null;
let _pgModule = null; // Caché del import para velocidad extrema

const getDbUrl = (c) => {
    if (c && c.env && c.env.DATABASE_URL) return c.env.DATABASE_URL;
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
};

export const executeQuery = async (c, query, params = []) => {
    const dbUrl = getDbUrl(c);
    if (!dbUrl) throw new Error('No database connection configuration found. Set DATABASE_URL.');

    // Normalizar placeholders ? → $1, $2...
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

    if (!_pgModule) {
        _pgModule = await import('pg');
    }
    const pg = _pgModule.default;

    const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('@db') || dbUrl.includes('@postgres');

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            // 1. Inicialización del Pool con Auto-Sanación
            if (!_pool) {
                _pool = new pg.Pool({
                    connectionString: dbUrl,
                    max: 5, // Límite bajo. Reutilizará estas conexiones para todo el bucle
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                    ssl: isLocalDb ? false : { rejectUnauthorized: false }
                });

                // 2. Si el Pool detecta un error de fondo (ej. socket cerrado por Supabase), lo reseteamos
                _pool.on('error', (err) => {
                    console.warn('[DB] Socket inactivo cerrado por el servidor. Limpiando pool...');
                    _pool = null;
                });
            }

            // 3. Ejecutamos la consulta. El Pool reutiliza la conexión activa.
            const result = await _pool.query(pgQuery, params);
            return result.rows;

        } catch (error) {
            const errMsg = error.message || '';

            // 4. Si chocamos con un socket "Zombi", destruimos el Pool y reintentamos
            if (errMsg.includes('terminated unexpectedly') ||
                errMsg.includes('ECONNRESET') ||
                errMsg.includes('Client was closed') ||
                errMsg.includes('socket closed')) {

                console.warn(`[DB] Conexión zombi detectada. Sanando el pool e intentando de nuevo (${attempts}/${maxAttempts})...`);

                // Destruir el pool corrupto para forzar uno nuevo limpio
                if (_pool) {
                    _pool.end().catch(() => { });
                    _pool = null;
                }

                if (attempts >= maxAttempts) throw error;

                // Micro-pausa de seguridad antes de reconectar
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            // Si es un error real (ej. sintaxis SQL mala), lo lanzamos
            console.error('PostgreSQL Query Error:', error);
            throw error;
        }
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