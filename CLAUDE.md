# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start full local environment (backend + DB + Tailwind watcher):**
```bash
docker compose up -d
```

**Run the full test suite:**
```bash
docker compose exec backend npm test -- --no-color
```

**Run a single test file:**
```bash
docker compose exec backend npx vitest run tests/waiter.test.js --no-color
```

**Build CSS for production (before deploying):**
```bash
docker compose run --rm tailwind npx tailwindcss -i ./input.css -o ./style.css --minify
```

**Deploy backend to Cloudflare Workers (from `backend/`):**
```bash
npx wrangler deploy
```

## Local Access

Each frontend is served on a virtual subdomain. Add these to `/etc/hosts` (pointing to `127.0.0.1`) to access them locally:
- `localhost` → Portal Maestro (`frontends/core/`)
- `admin.localhost` → Admin panel
- `cashier.localhost` → Cashier / POS
- `kitchen.localhost` → Kitchen display (KDS)
- `waiters.localhost` → Waiter app
- `menu.localhost` → Public digital menu
- `api.localhost` → Direct API access

## Architecture Overview

### The Workflow Engine (Core Pattern)

Every API endpoint is defined as a **declarative JSON schema** in `backend/src/engine/schemas/<module>/<action>.schema.json`. Each schema is a state machine with:
- `api` block: HTTP method, path, auth requirements, and body validation rules
- `startAt` / `nodes`: a graph of `action` and `decision` nodes referencing handler names
- Handlers are functions registered in `backend/src/engine/registry.js` (the `ActionRegistry`)

The `schemaRouter.js` reads all schemas at startup via `schema-registry.js` (a static index compatible with Cloudflare Workers, no filesystem access at runtime), auto-registers Hono routes, validates request bodies, and calls `orchestrator.js` to run the workflow.

**To add a new endpoint:**
1. Create `backend/src/engine/schemas/<module>/<action>.schema.json`
2. Write the handler function in the appropriate `src/helpers/*.helper.js`
3. Register the handler in `src/engine/registry.js` → `ActionRegistry`
4. The route registers itself automatically — no changes to `index.js` needed

### The Hybrid DB Adapter (`src/db/connection.js`)

`executeQuery(c, sql, params)` is the single DB entry point and behaves differently by environment:
- **Docker/Node (dev + tests):** Uses `pg` library with a TCP connection pool directly to PostgreSQL. Params use `$1, $2` placeholders natively.
- **Cloudflare Workers (production):** Cannot use TCP. Instead, interpolates `$1, $2` params into a safe SQL string, then sends it to a PostgreSQL RPC proxy function (`kore_exec_sql`) via Supabase's HTTP SDK.

Business logic heavily uses PostgreSQL stored procedures (`CALL sp_upsert_employee(...)`). Never replace these with inline SQL — the stored procedure pattern is intentional for transactional integrity.

### Module Map

| Module key | URL prefix | Schema folder | 
|---|---|---|
| `admin` | `/api/admin` | `schemas/admin/` |
| `kitchen` | `/api/kitchen` | `schemas/kitchen/` |
| `inventory` | `/api/inventory` | `schemas/inventory/` |
| `public` | `/api` | `schemas/public/` |

To add a new module, create its schema folder and add an entry to both `route-registry.js` and `src/engine/schema-registry.js`.

### Frontend Structure

Frontends are plain HTML/JS/CSS — no bundler. Each app under `frontends/<app>/` is a self-contained SPA. Shared utilities live in `frontends/shared/` and `frontends/core/`. Nginx serves each as a virtual host and proxies `/api/` calls to the backend container.

The `functions/api/env.js` Cloudflare Pages Function exposes `SUPABASE_URL` and `SUPABASE_ANON_KEY` to frontends that need to connect to Supabase directly (e.g., the kitchen screen for real-time). This runs in the `wrangler` Docker container locally.

## Testing Notes

- Tests use **real PostgreSQL** — no mocks. The `vitest.config.js` disables file-level parallelism to prevent data collisions. Each test file manages its own setup/teardown with `beforeAll` / `afterAll`.
- `DATABASE_URL` must be set in the environment (automatically provided by Docker Compose).
- The CI pipeline runs tests against an ephemeral PostgreSQL service container before any deployment.

## CI/CD Pipeline

Push to `main` triggers a four-stage pipeline: lint → test (ephemeral PostgreSQL) → DB migration on Supabase → deploy (Cloudflare Worker for the API + six Cloudflare Pages sites for the frontends). Secrets required: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_DB_URL`.
