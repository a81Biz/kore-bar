// ============================================================
// migrate-hash-pins.js
// Script de migración: hashea todos los pin_code en texto plano
//
// Ejecución: node backend/db/migrations/migrate-hash-pins.js
//
// IMPORTANTE: Ejecutar UNA SOLA VEZ después de aplicar 12_auth_pin_hash.sql
// El script detecta PINs ya hasheados ($2b$) y los salta.
// ============================================================

import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/kore_bar'
});

const SALT_ROUNDS = 10;

async function migrateHashPins() {
    const client = await pool.connect();

    try {
        // Obtener todos los empleados con PIN no nulo
        const { rows } = await client.query(
            `SELECT employee_number, pin_code FROM employees WHERE pin_code IS NOT NULL`
        );

        console.log(`[Migración] Encontrados ${rows.length} empleados con PIN.`);

        let hashed = 0;
        let skipped = 0;

        for (const row of rows) {
            // Saltar PINs que ya están hasheados (empiezan con $2b$ o $2a$)
            if (row.pin_code.startsWith('$2b$') || row.pin_code.startsWith('$2a$')) {
                skipped++;
                continue;
            }

            const hash = await bcrypt.hash(row.pin_code, SALT_ROUNDS);

            await client.query(
                `UPDATE employees SET pin_code = $1, updated_at = NOW() WHERE employee_number = $2`,
                [hash, row.employee_number]
            );

            hashed++;
            console.log(`  ✓ ${row.employee_number} — PIN hasheado`);
        }

        console.log(`\n[Migración] Completada: ${hashed} hasheados, ${skipped} ya estaban hasheados.`);

    } catch (err) {
        console.error('[Migración] Error:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrateHashPins();