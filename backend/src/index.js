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
  // Las 3 puertas de Supabase
  const urls = {
    "PUERTA_1_DIRECTA_IPV6": "postgresql://postgres:Enha4Ed70peqP57C@db.qbkmacwexphsitaiekvy.supabase.co:5432/postgres",
    "PUERTA_2_POOLER_6543": "postgresql://postgres.qbkmacwexphsitaiekvy:Enha4Ed70peqP57C@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    "PUERTA_2_POOLER_6543_NoSSL": "postgresql://postgres.qbkmacwexphsitaiekvy:Enha4Ed70peqP57C@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
    "PUERTA_3_POOLER_5432": "postgresql://postgres.qbkmacwexphsitaiekvy:Enha4Ed70peqP57C@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
  };

  const resultados = {};

  for (const [nombre, url] of Object.entries(urls)) {
    // Si es la directa, le forzamos el SSL de Node. Si es el pooler, dejamos que la URL actúe.
    const sslConfig = nombre.includes('DIRECTA') ? { rejectUnauthorized: false } : undefined;

    const client = new pg.Client({
      connectionString: url,
      ssl: sslConfig,
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect();
      const res = await client.query('SELECT 1 as exito');
      await client.end();
      resultados[nombre] = "✅ CONEXION PERFECTA";
    } catch (error) {
      resultados[nombre] = "❌ " + (error.message || "Error desconocido");
    }
  }

  return c.json(resultados);
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
