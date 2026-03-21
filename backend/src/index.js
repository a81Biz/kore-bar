import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { swaggerUI } from '@hono/swagger-ui';
import { generateOpenAPISpec } from './engine/swagger.js';
import { buildRoutes } from './engine/schemaRouter.js';
import { RouteRegistry } from './engine/route-registry.js';
import pg from 'pg';


const app = new Hono();

// Enable CORS for frontend applications
app.use('/*', cors());

// 🟢 ENDPOINT DE DIAGNÓSTICO CRUDO
app.get('/api/test-db', async (c) => {
  const dbUrl = c.env?.DATABASE_URL || process.env.DATABASE_URL;

  if (!dbUrl) return c.json({ error: 'No se detectó DATABASE_URL en Cloudflare' }, 400);

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const result = await client.query('SELECT 1 as success, current_database() as db_name');
    await client.end();
    return c.json({
      status: 'CONEXION EXITOSA',
      datos: result.rows,
      url_usada: dbUrl.substring(0, 30) + '...' // Solo vemos el inicio para confirmar cuál está usando
    });
  } catch (error) {
    return c.json({
      status: 'ERROR FATAL',
      mensaje: error.message,
      connectionString: dbUrl,
      codigo: error.code
    }, 500);
  }
});

app.get('/', (c) => { return c.text('Kore Bar API running') });

app.get('/api/docs/openapi.json', (c) => c.json(generateOpenAPISpec()));
app.get('/api/docs', swaggerUI({ url: '/api/docs/openapi.json' }));

// Montar todos los módulos automáticamente desde el registry
for (const [subDir, prefix] of Object.entries(RouteRegistry)) {
  const router = new Hono();
  buildRoutes(router, subDir);
  app.route(prefix, router);
}

// ── Arranque local (Node.js) ──────────────────────────────────
// Detectamos si estamos en Cloudflare Workers de forma infalible
const isCloudflare = typeof WebSocketPair !== 'undefined';

if (!isCloudflare && typeof process !== 'undefined' && process.env.NODE_ENV !== 'test' && !process.env.VITEST && !process.env.CF_PAGES) {
  // Solo se ejecuta en tu computadora (Docker/Local)
  import('@hono/node-server').then(({ serve }) => {
    const port = 8000;
    console.log(`Server is running on port ${port}`);
    serve({ fetch: app.fetch, port });
  }).catch(err => console.error("Error arrancando el servidor local:", err));
}

// Export para Cloudflare Workers (el runtime consume este default export)
export default app;
