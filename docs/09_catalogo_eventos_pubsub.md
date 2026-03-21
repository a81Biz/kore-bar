# Catálogo de Eventos PubSub

Este documento es la **Única Fuente de Verdad** para todos los eventos del bus de comunicación interno (`PubSub`). Antes de crear un nuevo evento, verificar que no exista uno equivalente. Antes de suscribirse a un evento, verificar el payload documentado aquí.

El bus de eventos (`/shared/js/pubsub.js`) es síncrono y vive en memoria. No persiste entre navegaciones — las suscripciones se crean al montar cada vista y desaparecen cuando la vista se desmonta (al hacer `viewManager.mount()` de otra vista).

---

## Convención de Nombres

Los eventos siguen el patrón `SUSTANTIVO_VERBO_EN_PASADO` en mayúsculas:

- ✅ `ZONAS_ACTUALIZADAS`
- ✅ `CATEGORIAS_ACTUALIZADAS`
- ✅ `NAVIGATE`
- ❌ `zonas_update`
- ❌ `updateZonas`

---

## Catálogo Completo

### `NAVIGATE`

| Campo | Valor |
|---|---|
| **Quién publica** | `sidebar.js` (al hacer clic en `button[data-nav]`) |
| **Quién escucha** | `app.js` (para ejecutar la ruta), `sidebar.js` (para marcar el botón activo) |
| **Payload** | `string` — nombre de la ruta (ej. `'piso'`, `'empleados'`, `'menu'`) |
| **Cuándo** | Al hacer clic en cualquier botón de navegación del sidebar, o al arrancar la SPA para la vista inicial. |

```javascript
// Emisión
PubSub.publish('NAVIGATE', 'piso');

// Suscripción en app.js
PubSub.subscribe('NAVIGATE', (viewName) => {
    const routeAction = Routes[viewName];
    if (routeAction) routeAction();
});

// Suscripción en sidebar.js para el estado activo
PubSub.subscribe('NAVIGATE', (viewName) => {
    _render.setActiveState(viewName);
});
```

---

### `ZONAS_ACTUALIZADAS`

| Campo | Valor |
|---|---|
| **Quién publica** | `zonas.js` → `logic.cargarDatos()` al final de cada operación exitosa (crear / borrar zona). |
| **Quién escucha** | `piso/index.js` — redistribuye a `MesasController.actualizarZonas()` y `AsignacionesController.actualizarZonas()`. |
| **Payload** | `Array<Zone>` — el arreglo completo de zonas activas tal como lo devuelve la BD. |
| **Cuándo** | Después de crear una zona, borrar una zona, o al cargar inicialmente el módulo de Piso. |

```javascript
// Emisión (en zonas.js)
PubSub.publish('ZONAS_ACTUALIZADAS', state.datos.lista);

// Suscripción (en piso/index.js)
PubSub.subscribe('ZONAS_ACTUALIZADAS', (zonas) => {
    MesasController.actualizarZonas(zonas);
    AsignacionesController.actualizarZonas(zonas);
});
```

**Estructura del payload (item de zona):**
```javascript
{
    zoneCode: 'TERR',
    name:     'Terraza VIP',
    isActive: true
}
```

---

### `MESAS_ACTUALIZADAS`

| Campo | Valor |
|---|---|
| **Quién publica** | `mesas.js` → `logic.cargarMesas()` al final de cada operación exitosa (crear / borrar mesa). |
| **Quién escucha** | `piso/index.js` — redistribuye a `AsignacionesController.actualizarMesas()` para recalcular el PAX del resumen operativo. |
| **Payload** | `Array<Table>` — el arreglo completo de mesas activas. |
| **Cuándo** | Después de crear o borrar una mesa. |

```javascript
// Emisión (en mesas.js)
PubSub.publish('MESAS_ACTUALIZADAS', state.datos.mesas);

// Suscripción (en piso/index.js)
PubSub.subscribe('MESAS_ACTUALIZADAS', (mesas) => {
    AsignacionesController.actualizarMesas(mesas);
});
```

**Estructura del payload (item de mesa):**
```javascript
{
    tableId:  'T-01',
    zoneCode: 'TERR',
    capacity: 4,
    isActive: true
}
```

---

### `CATEGORIAS_ACTUALIZADAS`

| Campo | Valor |
|---|---|
| **Quién publica** | `menu/categorias.js` → `logic.cargarCategorias()` al final de cada operación exitosa (crear / borrar categoría). |
| **Quién escucha** | `menu/index.js` — llama a `PlatillosController.actualizarCategorias()` para re-hidratar los selectores de categoría en el formulario de platillos y en el filtro. |
| **Payload** | `Array<Category>` — el arreglo completo de categorías tal como lo devuelve la BD. |
| **Cuándo** | Después de crear una categoría, borrar una categoría, o al cargar inicialmente el módulo de Menú. |

```javascript
// Emisión (en menu/categorias.js)
PubSub.publish('CATEGORIAS_ACTUALIZADAS', state.datos.categorias);

// Suscripción (en menu/index.js)
PubSub.subscribe('CATEGORIAS_ACTUALIZADAS', async () => {
    await PlatillosController.actualizarCategorias();
});
```

**Estructura del payload (item de categoría):**
```javascript
{
    categoryCode: 'BEB',
    name:         'Bebidas',
    description:  'Cocteles y sin alcohol',
    isActive:     true
}
```

---

## Diagrama de Flujo por Módulo

```
MÓDULO PISO
───────────
zonas.js           →  publica  ZONAS_ACTUALIZADAS(lista)
                              ↓
piso/index.js      →  escucha  → MesasController.actualizarZonas(zonas)
                              → AsignacionesController.actualizarZonas(zonas)

mesas.js           →  publica  MESAS_ACTUALIZADAS(mesas)
                              ↓
piso/index.js      →  escucha  → AsignacionesController.actualizarMesas(mesas)


MÓDULO MENÚ
───────────
categorias.js      →  publica  CATEGORIAS_ACTUALIZADAS(cats)
                              ↓
menu/index.js      →  escucha  → PlatillosController.actualizarCategorias()


NAVEGACIÓN GLOBAL
─────────────────
sidebar.js         →  publica  NAVIGATE('piso')
                              ↓
app.js             →  escucha  → Routes['piso']()
sidebar.js         →  escucha  → _render.setActiveState('piso')
```

---

## Reglas para Nuevos Eventos

Al agregar un evento al sistema, seguir estos pasos en orden:

1. **Documentar aquí primero** — nombre, quién publica, quién escucha, estructura del payload.
2. **Implementar la emisión** en el módulo publicador justo después de la operación exitosa.
3. **Implementar la suscripción** en el orquestador (`index.js`) del módulo padre, nunca en el módulo hijo que ya publica.
4. **Verificar el ciclo de vida** — la suscripción se registra al hacer `mount()`. Si el módulo se desmonta (navegación a otra vista), la suscripción desaparece automáticamente por el `viewManager.mount()` que limpia el DOM. No es necesario des-suscribirse manualmente salvo en módulos de larga vida como el sidebar.

**Anti-patrón a evitar:** un módulo que se suscribe a su propio evento. Si `zonas.js` publicara `ZONAS_ACTUALIZADAS` y también se suscribiera a él, se crearía un ciclo. La suscripción siempre la hace el orquestador padre.
---

## Eventos del Micrositio POS Mesero (`waiters.localhost`)

### `AUTH_SUCCESS`

| Campo | Valor |
|---|---|
| **Quién publica** | `waiters/js/app.js` — tras validar el PIN con el backend (respuesta 200). |
| **Quién escucha** | `waiters/js/app.js` — para montar la vista de dashboard y guardar el estado de sesión. |
| **Payload** | `Object` — datos del empleado autenticado. |
| **Cuándo** | Cuando el backend confirma el PIN del mesero y devuelve los datos de sesión. |

```javascript
// Estructura del payload
{
    employeeNumber: 'E-001',
    name:           'Juan Pérez',
    pin:            '1234'   // solo en memoria de sesión, no persiste
}
```

```javascript
// Emisión (en waiters/app.js tras login exitoso)
PubSub.publish('AUTH_SUCCESS', { employeeNumber, name });

// Suscripción (en waiters/app.js)
PubSub.subscribe('AUTH_SUCCESS', (employee) => {
    state.session = employee;
    viewManager.mount('tpl-dashboard');
});
```

---

### `TABLE_SELECTED`

| Campo | Valor |
|---|---|
| **Quién publica** | `waiters/js/app.js` — al tocar una mesa en el layout de piso. |
| **Quién escucha** | `waiters/js/app.js` — para montar la vista de comanda con el contexto de la mesa. |
| **Payload** | `Object` — datos básicos de la mesa seleccionada. |
| **Cuándo** | Cuando el mesero toca una mesa en el layout (`AVAILABLE` u `OCCUPIED`). |

```javascript
// Estructura del payload
{
    tableCode:  'T-01',
    tableId:    'T-01',
    status:     'AVAILABLE' // | 'OCCUPIED'
}
```

```javascript
// Emisión (en layout al click de mesa)
PubSub.publish('TABLE_SELECTED', { tableCode, status });

// Suscripción (en waiters/app.js)
PubSub.subscribe('TABLE_SELECTED', (table) => {
    state.selectedTable = table;
    viewManager.mount('tpl-order');
});
```

---

### `ORDER_COMPLETED`

| Campo | Valor |
|---|---|
| **Quién publica** | `waiters/js/app.js` — tras enviar la comanda al backend (submit de `#form-submit-order`). |
| **Quién escucha** | `waiters/js/app.js` — para regresar al layout de piso y refrescar el estado de mesas. |
| **Payload** | `Object` — resumen de la orden enviada. |
| **Cuándo** | Cuando la comanda se envía exitosamente a cocina. |

```javascript
// Estructura del payload
{
    orderCode:  'ORD-001',
    tableCode:  'T-01'
}
```

```javascript
// Emisión (en order.js tras submit exitoso)
PubSub.publish('ORDER_COMPLETED', { orderCode, tableCode });

// Suscripción (en waiters/app.js)
PubSub.subscribe('ORDER_COMPLETED', () => {
    viewManager.mount('tpl-dashboard');
});
```

---

### `LOGOUT_TRIGGERED`

| Campo | Valor |
|---|---|
| **Quién publica** | `waiters/js/app.js` — al presionar el botón de logout. |
| **Quién escucha** | `waiters/js/app.js` — para limpiar la sesión y regresar a la vista de login. |
| **Payload** | `null` — sin payload. |
| **Cuándo** | Cuando el mesero cierra su sesión manualmente. |

```javascript
// Emisión
PubSub.publish('LOGOUT_TRIGGERED', null);

// Suscripción (en waiters/app.js)
PubSub.subscribe('LOGOUT_TRIGGERED', () => {
    state.session = null;
    state.selectedTable = null;
    viewManager.mount('tpl-login');
});
```

---

## Eventos del Micrositio POS Cocina (`kitchen.localhost`)

### `OPEN_MODAL`

| Campo | Valor |
|---|---|
| **Quién publica** | `kitchen/js/app.js` — al abrir cualquier modal del módulo de recetas/ingredientes. |
| **Quién escucha** | `kitchen/js/app.js` — para montar el contenido del modal y activar el overlay. |
| **Payload** | `Object` — tipo y datos del modal a abrir. |
| **Cuándo** | Al hacer clic en botones de agregar ingrediente, editar ficha técnica, o cualquier acción que requiera un modal en KDS/Recetas. |

```javascript
// Estructura del payload
{
    type:    'ingredient' | 'tech-sheet' | 'confirm',
    data:    Object       // datos específicos del modal (el platillo, ingrediente, etc.)
}
```

```javascript
// Emisión (en cualquier vista de cocina)
PubSub.publish('OPEN_MODAL', { type: 'ingredient', data: { dishCode } });

// Suscripción (en kitchen/app.js)
PubSub.subscribe('OPEN_MODAL', ({ type, data }) => {
    ModalController.open(type, data);
});
```

---

## Diagrama Actualizado — Todos los Micrositios

```
MÓDULO PISO (admin.localhost)
──────────────────────────────
zonas.js           →  publica  ZONAS_ACTUALIZADAS(lista)     →  piso/index.js
mesas.js           →  publica  MESAS_ACTUALIZADAS(mesas)     →  piso/index.js
categorias.js      →  publica  CATEGORIAS_ACTUALIZADAS(cats) →  menu/index.js
sidebar.js         →  publica  NAVIGATE('piso')              →  app.js + sidebar.js

POS MESERO (waiters.localhost)
──────────────────────────────
app.js (login OK)  →  publica  AUTH_SUCCESS(employee)        →  app.js (mount dashboard)
layout (mesa)      →  publica  TABLE_SELECTED(table)         →  app.js (mount order)
order.js (OK)      →  publica  ORDER_COMPLETED(order)        →  app.js (mount dashboard)
app.js (logout)    →  publica  LOGOUT_TRIGGERED(null)        →  app.js (mount login)

POS COCINA (kitchen.localhost)
──────────────────────────────
vistas cocina      →  publica  OPEN_MODAL({type, data})      →  app.js (ModalController)
```
