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

    // ── Test 1: Alcanzabilidad de Supabase ────────────────────────────────────
    // El endpoint raíz /rest/v1/ devuelve 401 con el anon key — eso es NORMAL.
    // Solo comprobamos que el servidor responda (cualquier HTTP = alcanzable).
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, { headers });
        report.supabase.reachable   = true;
        report.supabase.httpStatus  = res.status;
    } catch (e) {
        report.supabase.error = e.message;
    }

    // ── Test 2: RLS — anon puede SELECT en cada tabla de Realtime ────────────
    // HTTP 200 = credenciales válidas + política RLS permite SELECT.
    // HTTP 401 = anon key inválido.
    // HTTP 403 = credenciales válidas pero RLS bloquea (WebSocket conecta pero sin eventos).
    const tables = ['waiter_calls', 'order_items', 'order_headers'];
    let anyOk = false;
    for (const table of tables) {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=0`, { headers });
            if (res.status === 200) {
                anyOk = true;
                report.rlsCheck[table] = `✅ accesible (HTTP 200)`;
            } else if (res.status === 401) {
                report.rlsCheck[table] = `❌ anon key rechazado (HTTP 401) — clave incorrecta`;
            } else if (res.status === 403) {
                report.rlsCheck[table] = `🟡 bloqueado por RLS (HTTP 403) — WebSocket conectará pero sin eventos. Añadir política SELECT para rol anon.`;
            } else {
                report.rlsCheck[table] = `⚠️ HTTP ${res.status}`;
            }
        } catch (e) {
            report.rlsCheck[table] = `❌ error de red: ${e.message}`;
        }
    }
    report.supabase.credentialsValid = anyOk;

    // ── Test 3: Estado de la publicación supabase_realtime ───────────────────
    // Llama a kore_realtime_status() vía Supabase RPC — devuelve si cada tabla
    // está registrada en la publicación (prerequisito para recibir eventos).
    try {
        const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/kore_realtime_status`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: '{}'
        });
        if (rpcRes.ok) {
            const pub = await rpcRes.json();
            const allInPub = pub.publication_exists &&
                Object.values(pub.tables || {}).every(Boolean);
            report.publication = {
                ...pub,
                verdict: !pub.publication_exists
                    ? '❌ Publicación supabase_realtime no existe en la BD'
                    : allInPub
                        ? '✅ Las 3 tablas están en la publicación — Realtime recibirá eventos'
                        : '❌ Alguna tabla NO está en la publicación — los eventos no llegarán al frontend'
            };
        } else {
            report.publication = {
                error: `kore_realtime_status() HTTP ${rpcRes.status} — ejecutar migration 14 en Supabase`
            };
        }
    } catch (e) {
        report.publication = { error: e.message };
    }

    // ── Veredicto final ───────────────────────────────────────────────────────
    const allRlsOk    = tables.every(t => report.rlsCheck[t].startsWith('✅'));
    const someBlocked = tables.some(t => report.rlsCheck[t].startsWith('🟡'));
    const creds401    = tables.every(t => report.rlsCheck[t].includes('401'));
    const pubOk       = report.publication?.verdict?.startsWith('✅');

    if (!report.supabase.reachable) {
        report.verdict = '🔴 Supabase NO alcanzable — revisar SUPABASE_URL';
    } else if (creds401) {
        report.verdict = '🔴 ANON KEY INVÁLIDO — copiar la clave correcta desde Supabase → Settings → API';
    } else if (someBlocked && !allRlsOk) {
        report.verdict = '🟡 CREDENCIALES OK — RLS bloquea alguna tabla. El WebSocket conecta pero no llegan eventos en esas tablas. Ver rlsCheck.';
    } else if (allRlsOk && !pubOk) {
        report.verdict = '🟡 CREDENCIALES Y RLS OK — pero las tablas NO están en la publicación supabase_realtime. El WebSocket no recibirá eventos de DB. Hacer push a main para que el CI corra migration 14, o ejecutarla manualmente: psql "$SUPABASE_DB_URL" -f backend/db/migrations/14_supabase_realtime.sql';
    } else if (allRlsOk && pubOk) {
        report.verdict = '🟢 TODO OK — Realtime debería funcionar. Si el frontend sigue en polling, revisar la consola del navegador para ver el error del canal WebSocket.';
    } else {
        report.verdict = '⚠️ Resultado mixto — revisar rlsCheck y publication';
    }

    return c.json(report, allRlsOk ? 200 : 503);
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
