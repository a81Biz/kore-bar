// src/db/connection.js
// ============================================================
// Adaptador de Base de Datos Estricto para Cloudflare Workers
// ============================================================

let _pgModule = null; // Caché del import para velocidad

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

    // Importación dinámica segura
    if (!_pgModule) {
        _pgModule = await import('pg');
    }
    const pg = _pgModule.default;

    const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('@db');

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;

        // 🟢 Cero Pools. Usamos un Cliente Efímero para no dejar "zombis" en Cloudflare.
        const client = new pg.Client({
            connectionString: dbUrl,
            ssl: isLocalDb ? false : { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
            query_timeout: 15000 // Aborta si la consulta tarda demasiado
        });

        try {
            await client.connect();
            const result = await client.query(pgQuery, params);
            return result.rows; // Éxito: devolvemos los datos

        } catch (error) {
            const errMsg = error.message || '';

            // Si hay un micro-corte de red, reintentamos silenciosamente
            if (errMsg.includes('terminated unexpectedly') || errMsg.includes('ECONNRESET') || errMsg.includes('Client was closed')) {
                if (attempts >= maxAttempts) throw error;
                await new Promise(resolve => setTimeout(resolve, 200 * attempts));
                continue;
            }

            console.error('PostgreSQL Query Error:', error);
            throw error;

        } finally {
            // 🟢 CRÍTICO: El 'await' aquí asegura que el socket se destruya por completo
            // ANTES de que Cloudflare termine la petición, erradicando el error de "Hung Code".
            await client.end().catch(() => { });
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