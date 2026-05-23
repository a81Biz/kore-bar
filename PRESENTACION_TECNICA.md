# Kore Bar OS — Presentación Técnica

---

## ¿Cuántas aplicaciones necesita un restaurante para sobrevivir el viernes en la noche?

La respuesta estándar de la industria: entre cuatro y seis sistemas desconectados — un POS, un KDS, un sistema de inventario, un panel de administración, quizá un módulo de nómina. Cada uno con su propia base de datos, su propio login, su propia forma de romper en producción.

**Kore Bar OS resuelve ese caos con una sola idea:**
> Cada operación del restaurante — desde abrir una mesa hasta cerrar la nómina — es un estado en un grafo declarativo. No código. Un JSON.

---

## El Problema que Resuelve

Un restaurante moderno opera simultáneamente en cuatro mundos distintos:

| Quién | Qué necesita | Cuándo |
|---|---|---|
| Mesero | Capturar orden, ver estado de la mesa | Tiempo real, sin fricción |
| Cocina | Ver tickets pendientes, marcar preparación | Instantáneo, sin mouse |
| Caja | Cobrar, imprimir ticket, emitir factura | Rápido y sin errores |
| Admin | Reportes, inventario, empleados, turnos | Asíncrono, datos confiables |

Los sistemas existentes resuelven cada uno de estos mundos por separado. Kore Bar OS los unifica desde la misma base de datos, el mismo backend y el mismo ciclo de deployment.

---

## La Arquitectura

### Un Backend, Seis Frontends

```
                    ┌─────────────────────────────────┐
                    │   nginx — virtual hosts          │
                    └────────────┬────────────────────┘
                                 │
     ┌───────────┬───────────┬───┴────────┬───────────┬────────────┐
     │           │           │            │           │            │
  meseros     cocina       caja        admin       menú       factura
 (POS/WAP)    (KDS)      (Cashier)   (Portal)   (Público)    (CFDI)
     │           │           │            │           │            │
     └───────────┴───────────┴────────────┴───────────┴────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │   Backend — Hono / Node.js       │
                    │   Cloudflare Workers (prod)      │
                    │                                  │
                    │   Auth Middleware                 │
                    │   JWT · PIN bcrypt · Area-scope  │
                    │                                  │
                    │   Workflow Engine                 │
                    │   SchemaRouter + ActionRegistry  │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │   PostgreSQL                     │
                    │   22 tablas · SPs · Views        │
                    │   + Supabase Realtime            │
                    └─────────────────────────────────┘
```

Cada frontend es HTML + Vanilla JS — sin bundler, sin framework, sin tiempo de build. Se despliegan como seis sitios estáticos en Cloudflare Pages. El backend corre en Cloudflare Workers: sin servidor, sin frío en el arranque.

---

### El Corazón: El Workflow Engine Declarativo

Esta es la decisión arquitectónica que lo cambia todo.

**Cada endpoint de la API no existe como código — existe como un JSON.**

```json
{
  "api": { "method": "POST", "path": "/api/waiters/tables/:tableId/open", "auth": "pin" },
  "startAt": "validate_table",
  "nodes": {
    "validate_table":  { "type": "decision", "handler": "isTableAvailable",
                         "on": { "true": "open_table", "false": "error_occupied" } },
    "open_table":      { "type": "action",   "handler": "openTable", "next": "notify_floor" },
    "notify_floor":    { "type": "action",   "handler": "broadcastTableOpened", "next": "END" }
  }
}
```

El `SchemaRouter` lee todos los schemas al arrancar. Las rutas se registran solas. El `ActionRegistry` mapea el string `"openTable"` a la función real. El `Orchestrator` ejecuta el grafo con un circuit breaker de 100 pasos.

**Agregar un nuevo endpoint al sistema significa escribir un JSON y una función handler. El router no se toca.**

El grafo de conocimiento del proyecto identificó **103 schemas activos** — 103 endpoints declarativos que cubren desde autenticación hasta generación de órdenes de compra automáticas.

---

### Lógica de Negocio en la Base de Datos

La decisión más contraintuitiva — y la más correcta.

Toda la lógica transaccional vive en stored procedures de PostgreSQL:

- `sp_pos_submit_order` — valida disponibilidad, inserta items, dispara el KDS en una sola transacción
- `sp_cashier_process_payment` — cobra, genera ticket, actualiza kardex de insumos consumidos
- `sp_kardex_transfer` — mueve stock entre ubicaciones con trazabilidad completa
- `sp_upsert_employee` — crea o actualiza empleados con manejo de duplicados idempotente

Las aplicaciones nunca arman SQL. Llaman procedimientos. Esto garantiza integridad incluso si hay múltiples clientes conectados al mismo tiempo — lo cual pasa cada viernes.

---

### Tiempo Real Sin Complejidad

El KDS y la app de meseros reciben actualizaciones en tiempo real. La implementación no reinventa WebSockets:

1. PostgreSQL emite `pg_notify` cuando cambia el estado de un item
2. Supabase captura eso y lo transmite como evento al frontend
3. Si el WebSocket cae, hay polling de respaldo cada 8–30 segundos

El frontend de cocina no sabe si los datos llegan por WebSocket o por polling — la interfaz es idéntica. Esto hace el sistema resiliente sin agregar dependencias de infraestructura.

---

### Tres Modos de Autenticación

El middleware de auth no es un boolean. Es un sistema de tres modos:

| Modo | Quién | Cómo |
|---|---|---|
| **Session JWT** | Admin, portal web | Cookie HttpOnly, expiración controlada |
| **PIN numérico** | Meseros, cajeros | bcrypt, sin email, sin SMS — el PIN se "plancha" en el dispositivo compartido |
| **Area-scope** | Tokens de área | Restringen acceso a zonas específicas del restaurante |

El campo `auth` en cada schema JSON declara qué modo aplica. El middleware decide. El código de negocio nunca ve tokens.

---

## Los Números

| Métrica | Valor |
|---|---|
| Frontends especializados | 6 |
| Endpoints API declarativos | 103 schemas JSON |
| Tablas en la BD | 22 relacionales |
| Stored procedures | 40+ |
| Vistas analíticas | 12 (ventas, KPIs, nómina) |
| Entidades en el grafo de arquitectura | 1,853 nodos · 4,233 relaciones |
| Comunidades arquitectónicas detectadas | 143 clusters |
| Cobertura de tests | 100% sobre PostgreSQL real (sin mocks) |
| Pipeline CI/CD | lint → test → migrate → deploy (4 etapas) |

---

## El Ciclo de Vida de una Orden

Para hacer concreto lo abstracto:

```
Mesero abre mesa       → sp_pos_open_table()
Mesero captura orden   → sp_pos_submit_order()   ──► KDS recibe en <1s
Cocina marca "listo"   → sp_kds_set_ready()      ──► Mesero ve notificación
Mesero cierra mesa     → sp_pos_close_table()
Cajero cobra           → sp_cashier_process_payment()
                         ├── Genera ticket
                         ├── Actualiza kardex (insumos consumidos)
                         └── Marca orden como facurable
Cliente pide factura   → fn_get_ticket_print_data() → CFDI vía SAT
```

Todo esto ocurre en una sola base de datos, sin microservicios, sin queues, sin coordinación distribuida. La transaccionalidad de PostgreSQL hace el trabajo pesado.

---

## Deployment

```
git push main
     │
     ├── Lint (ESLint)
     ├── Tests (Vitest + PostgreSQL efímero)
     ├── DB Migration (Supabase — 14 migraciones aplicadas en orden)
     └── Deploy
           ├── Cloudflare Workers  ← backend
           └── Cloudflare Pages ×6 ← cada frontend como sitio independiente
```

No hay servidores que mantener. No hay certificados SSL que renovar. No hay balanceadores de carga que configurar. La infraestructura completa es declarativa y vive en el repositorio.

---

## Lo Que Este Sistema Demuestra

Kore Bar OS no es un sistema de restaurante con una arquitectura bonita.

Es una demostración de que **la complejidad de un dominio no justifica la complejidad de la implementación** — siempre que tomes las decisiones correctas desde el inicio.

Un workflow engine declarativo. Lógica de negocio en la base de datos. Frontends sin framework. Deployment sin servidores.

Cada decisión fue tomada para que **la siguiente persona que extienda el sistema escriba menos código que la anterior**.

---

*El código está en el repositorio. El grafo de arquitectura está en `graphify-out/graph.html`. Las preguntas, aquí.*
