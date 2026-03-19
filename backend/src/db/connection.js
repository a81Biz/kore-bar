// src/db/connection.js
import pg from 'pg';
import { dbConfig } from '../config/database.config.js';

const { Client } = pg;

/**
 * Dynamically executes a query either on Cloudflare D1 or a local PostgreSQL instance.
 * 
 * @param {Object} c - The Hono Context object (contains Cloudflare bindings)
 * @param {string} query - The SQL query to execute
 * @param {Array} params - Array of parameters for the query
 * @returns {Promise<Array>} - The result rows
 */
export const executeQuery = async (c, query, params = []) => {
    // 1. Check for Cloudflare D1 Binding
    // In production/Cloudflare environment, `c.env.DB` will be bound to the D1 Database
    if (c && c.env && c.env.DB) {
        try {
            // Note: D1 uses SQLite dialect under the hood. 
            // In a real multi-dialect scenario, you might need light query translation here.

            let stmt = c.env.DB.prepare(query);
            if (params.length > 0) {
                stmt = stmt.bind(...params);
            }
            const { results } = await stmt.all();
            return results;
        } catch (error) {
            console.error('D1 Query Error:', error);
            throw error;
        }
    }

    // 2. Fallback to Local PostgreSQL (Docker)
    // If no D1 binding is found, assume we're running locally using the specified DATABASE_URL
    if (dbConfig.url) {
        const client = new Client({
            connectionString: dbConfig.url
        });

        try {
            await client.connect();

            // PostgreSQL requires parameterized queries to use $1, $2, etc. format.
            // If the incoming query uses question marks (?), we convert them to $x.
            let pgQuery = query;
            let paramIndex = 1;
            pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

            const result = await client.query(pgQuery, params);
            return result.rows;
        } catch (error) {
            console.error('PostgreSQL Query Error:', error);
            throw error;
        } finally {
            await client.end();
        }
    }

    throw new Error('No database connection configuration found.');
};

/**
 * Ejecuta un Procedimiento Almacenado (Mutación) mapeando un objeto a parámetros posicionales.
 * @param {Object} c - Contexto de Hono
 * @param {String} procedureName - Nombre del SP (ej. 'sp_upsert_employee')
 * @param {Object} params - Objeto literal con los parámetros
 * @returns {Promise<any>}
 */
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