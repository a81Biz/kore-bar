import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { swaggerUI } from '@hono/swagger-ui';
import { generateOpenAPISpec } from './engine/swagger.js';
import { buildRoutes } from './engine/schemaRouter.js';
import { RouteRegistry } from './engine/route-registry.js';

const app = new Hono();

// Enable CORS for frontend applications
app.use('/*', cors());

app.get('/', (c) => { return c.text('Kore Bar API running') });

app.get('/api/docs/openapi.json', (c) => c.json(generateOpenAPISpec()));
app.get('/api/docs', swaggerUI({ url: '/api/docs/openapi.json' }));

// Expone las variables de Supabase al frontend para inicializar el cliente realtime.
// En Cloudflare Workers las lee de c.env (bindings); en Node/Docker de process.env.
app.get('/api/env', (c) => {
    const supabaseUrl     = c.env?.SUPABASE_URL     ?? process.env?.SUPABASE_URL;
    const supabaseAnonKey = c.env?.SUPABASE_ANON_KEY ?? process.env?.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        return c.json({ error: 'Variables no configuradas' }, 500);
    }
    return c.json(
        { SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: supabaseAnonKey },
        200,
        { 'Cache-Control': 'public, max-age=300' }
    );
});

// ── Diagnóstico de Supabase Realtime ─────────────────────────────────────────
// Verifica que las secrets estén configuradas y que Supabase responda.
// Útil para depurar por qué los frontends caen en polling en producción.
app.get('/api/debug/realtime', async (c) => {
    const supabaseUrl     = c.env?.SUPABASE_URL     ?? process.env?.SUPABASE_URL;
    const supabaseAnonKey = c.env?.SUPABASE_ANON_KEY ?? process.env?.SUPABASE_ANON_KEY;

    const mask = (s) => s ? `${s.slice(0, 12)}...${s.slice(-4)}` : null;

    const report = {
        secrets: {
            SUPABASE_URL:      supabaseUrl     ? mask(supabaseUrl)     : '❌ NO CONFIGURADA',
            SUPABASE_ANON_KEY: supabaseAnonKey ? mask(supabaseAnonKey) : '❌ NO CONFIGURADA',
            configured: !!(supabaseUrl && supabaseAnonKey),
        },
        realtimeWsUrl: supabaseUrl
            ? `${supabaseUrl.replace('https://', 'wss://')}/realtime/v1/websocket`
            : null,
        supabase: { reachable: false, credentialsValid: false },
        rlsCheck:  {},
        verdict: '',
    };

    if (!supabaseUrl || !supabaseAnonKey) {
        report.verdict = '🔴 FALTA SECRETS — ejecuta: wrangler secret put SUPABASE_URL && wrangler secret put SUPABASE_ANON_KEY';
        return c.json(report, 503);
    }

    const headers = { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` };

    // ── Test 1: API REST de Supabase ──────────────────────────────────────────
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, { headers });
        report.supabase.reachable        = true;
        report.supabase.credentialsValid = res.status !== 401 && res.status !== 403;
        report.supabase.httpStatus       = res.status;
    } catch (e) {
        report.supabase.error = e.message;
    }

    // ── Test 2: RLS — anon puede SELECT en cada tabla de Realtime ────────────
    const tables = ['waiter_calls', 'order_items', 'order_headers'];
    for (const table of tables) {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=0`, { headers });
            report.rlsCheck[table] = res.ok
                ? `✅ accesible (HTTP ${res.status})`
                : `❌ bloqueado (HTTP ${res.status}) — revisar política RLS para rol anon`;
        } catch (e) {
            report.rlsCheck[table] = `❌ error: ${e.message}`;
        }
    }

    // ── Veredicto final ───────────────────────────────────────────────────────
    const allRlsOk = tables.every(t => report.rlsCheck[t].startsWith('✅'));
    if (!report.supabase.credentialsValid) {
        report.verdict = '🔴 CREDENCIALES INVÁLIDAS — el anon key no es aceptado por Supabase';
    } else if (!allRlsOk) {
        report.verdict = '🟡 CREDENCIALES OK pero RLS bloquea la lectura — el WebSocket conectará pero NO recibirá eventos. Añade política SELECT para rol anon en las tablas marcadas ❌';
    } else {
        report.verdict = '🟢 TODO OK — las credenciales son válidas y las tablas son accesibles. Si el frontend sigue en polling, verifica que la publicación supabase_realtime incluya las tablas (migration 14).';
    }

    return c.json(report, report.supabase.credentialsValid ? 200 : 503);
});

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
