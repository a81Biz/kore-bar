// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Todos los tests comparten una sola BD PostgreSQL.
        // Ejecutar archivos en paralelo causa colisiones de datos.
        fileParallelism: false,

        // Tests DENTRO de cada archivo ya corren en serie por defecto.
        // Timeout generoso para los E2E que hacen ciclo completo de orden.
        testTimeout: 30000,
    }
});