# Guía de Arquitectura Frontend: Plantillas, Módulos y Delegación

Bienvenido a la arquitectura Frontend de **Kore Bar**.
Este sistema está construido en Vanilla JavaScript puro, priorizando el alto rendimiento, la separación estricta de responsabilidades y la modularidad extrema.

Para lograr esto sin frameworks pesados, nos regimos por tres pilares:

1. **El HTML vive en el HTML** (Uso estricto de `<template>`).
2. **El JavaScript se divide en 7 Secciones** (Patrón de Módulo Revelador).
3. **Cero Lógica de Negocio en la UI** (El backend mastica los datos, el front solo pinta).

---

## 🏗️ 1. El HTML: Plantillas (Templates) y Cero Lógica

Toda la estructura visual de una pantalla o de sus componentes repetitivos (como filas de una tabla o tarjetas) debe residir en el archivo `.html` como `<template>`.

* **PROHIBIDO:** Usar atributos como `onclick="..."` en el HTML.
* **PROHIBIDO:** Armar strings de HTML usando `innerHTML = '<tr>...'` en los archivos `.js`.
* **PERMITIDO:** Usar `innerHTML = ''` exclusivamente para **limpiar** un contenedor antes de repintarlo.

**Ejemplo de estructura:**

```html
<tbody id="tabla-empleados-body"></tbody>

<template id="tpl-fila-empleado">
    <tr class="hover:bg-slate-50 border-b">
        <td class="col-nombre p-4 font-medium text-slate-800"></td>
        <td class="p-4">
            <span class="col-badge px-2.5 py-1 text-xs rounded-full"></span>
        </td>
        <td class="p-4 text-right">
            <button class="btn-editar text-indigo-600 p-2" title="Editar">
                <span class="material-symbols-outlined">edit</span>
            </button>
        </td>
    </tr>
</template>
```

---

## ⚙️ 2. La Anatomía del Módulo JS (Las 7 Secciones)

Cada controlador de vista debe seguir una estructura estricta de **7 secciones**. Todo lo que no se exporte en la sección 7 es privado por diseño.

```javascript
// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal } from '/shared/js/ui.js';
import { ValidatorEngine } from '/shared/js/validationEngine.js';
import { MisReglas } from '../rules/mis.rules.js';

// ⚠️ REGLA DE ENDPOINTS (Single Source of Truth HTTP):
// Queda estrictamente prohibido escribir URLs como fetch('/api/users') en los controladores.
// Todas las peticiones HTTP consumen ENDPOINTS desde /shared/js/endpoints.js.

// ==========================================================================
// 2. ESTADO PRIVADO Y CONFIGURACIÓN
// ==========================================================================
const _datos = { lista: [] };
const _dom   = {};

const _motorValidacion = new ValidatorEngine(MisReglas);

// Diccionario UI: aísla las clases de Tailwind de la lógica de negocio
const _uiConfig = {
    badges: {
        'ACTIVO':  'bg-emerald-100 text-emerald-800',
        'DEFAULT': 'bg-slate-100 text-slate-800'
    }
};

// ==========================================================================
// 3. CACHÉ DEL DOM (Privado)
// ==========================================================================
// Capturamos los elementos UNA SOLA VEZ al montar la vista.
const _cacheDOM = (container) => {
    _dom.tbody   = container.querySelector('#tabla-empleados-body');
    _dom.template = document.querySelector('#tpl-fila-empleado');
    _dom.btnSync = container.querySelector('#btn-sync');
};

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO (Privado)
// ==========================================================================
// Exclusivo para clonar templates e inyectar datos. SIN lógica de negocio.
const _render = () => {
    _dom.tbody.innerHTML = '';

    _datos.lista.forEach(item => {
        const clon = _dom.template.content.cloneNode(true);

        clon.querySelector('.col-nombre').textContent = item.nombre;

        const badge = clon.querySelector('.col-badge');
        badge.textContent = item.estado;
        badge.className += ` ${_uiConfig.badges[item.estado] || _uiConfig.badges.DEFAULT}`;

        clon.querySelector('.btn-editar').setAttribute('data-id', item.id);

        _dom.tbody.appendChild(clon);
    });
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS (Privado)
// ==========================================================================
const _cargarDatos = async () => {
    const res = await fetchData(ENDPOINTS.admin.get.employees);
    _datos.lista = res.data || [];
    _render();
};

// ==========================================================================
// 6. EVENTOS (Privado)
// ==========================================================================
const _bindEvents = () => {
    // A) ESTÁTICOS: elementos fijos que siempre existen en el DOM
    if (_dom.btnSync) {
        _dom.btnSync.addEventListener('click', _cargarDatos);
    }

    // B) DINÁMICOS: delegación al padre estático para evitar memory leaks
    _dom.tbody.addEventListener('click', (e) => {
        const btnEditar = e.target.closest('.btn-editar');
        if (btnEditar) {
            const id = btnEditar.getAttribute('data-id');
            _abrirModal(id);
        }
    });
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const EmpleadosController = {
    mount: async (container) => {
        _cacheDOM(container);
        _bindEvents();
        await _cargarDatos();
    },
    refresh: async () => await _cargarDatos()
};
```

---

## 🧩 3. Cuándo Fracturar un Módulo (Módulo Compuesto)

Un módulo empieza como un único archivo de 7 secciones. Cuando su complejidad supera los siguientes umbrales, **debe fracturarse** en carpeta con tres archivos internos:

| Señal de alerta | Acción |
|---|---|
| El archivo supera ~300 líneas | Fracturar |
| El estado privado tiene más de 5 sub-objetos | Extraer a `state.js` |
| La sección de render tiene más de 3 funciones distintas | Extraer a `view.js` |
| La sección de lógica hace más de 3 llamadas HTTP distintas | Extraer a `logic.js` |

**Estructura resultante:**

```
views/
  empleados/
    index.js     ← Orquestador: solo importa y conecta los tres
    state.js     ← Sección 2: datos, dom, uiConfig, motorValidacion
    view.js      ← Secciones 3 y 4: cacheDOM + render
    logic.js     ← Sección 5: lógica de negocio y llamadas HTTP
```

El archivo `index.js` (o `empleados.js` a nivel de `views/`) actúa como fachada: importa todo y expone solo la API pública.

```javascript
// views/empleados.js — Fachada del módulo fracturado
import { bindForm } from '/shared/js/formEngine.js';
import { state }    from './empleados/state.js';
import { render }   from './empleados/view.js';
import { logic }    from './empleados/logic.js';

const cacheDOM   = (container) => { /* ... usa state.dom */ };
const bindEvents = () => { /* ... usa logic.* y render.* */ };

export const mount = async (container) => {
    cacheDOM(container);
    bindEvents();
    await logic.loadAll();
};
```

> **Regla de imports en módulos fracturados:** `state.js` no importa de `view.js` ni `logic.js`. `view.js` solo importa de `state.js`. `logic.js` importa de `state.js` y puede llamar a `render.*` para actualizar la vista tras una operación. El flujo de dependencia es siempre unidireccional: `logic → view → state`.

---

## 🌐 4. Contrato del HTTP Client

Todas las peticiones usan las funciones de `/shared/js/http.client.js`. Nunca se usa `fetch()` directamente en los controladores.

### Funciones disponibles

```javascript
// GET — sin body
const res = await fetchData(ENDPOINTS.admin.get.employees);
// POST — con body
const res = await postData(ENDPOINTS.admin.post.zone, { zoneCode: 'T', name: 'Terraza' });
// PUT — con body y parámetros de ruta
const res = await putData(ENDPOINTS.admin.put.employee, payload, { id: '80219601' });
// DELETE — solo parámetros de ruta
const res = await deleteData(ENDPOINTS.admin.delete.zone, { code: 'T' });
```

### Reemplazo dinámico de parámetros

El `http.client.js` reemplaza los tokens `:param` en la ruta automáticamente:

```javascript
// ENDPOINTS.admin.put.employee = '/admin/employees/:id'
// Al pasar { id: '80219601' } como tercer argumento:
// → URL final: http://api.localhost/api/admin/employees/80219601
await putData(ENDPOINTS.admin.put.employee, payload, { id: emp.employee_number });
```

### Contrato de respuesta

Todas las funciones lanzan un `Error` si el servidor responde con `!response.ok`. El mensaje del error viene de `jsonResponse.error || jsonResponse.message`. Por eso en los controladores es suficiente con:

```javascript
try {
    await postData(ENDPOINTS.admin.post.zone, payload);
    showSuccessModal('Zona creada.');
    await logic.cargarDatos();
} catch (error) {
    showErrorModal(error.message); // El mensaje ya viene limpio del servidor
}
```

---

## 🎯 5. Eventos Dinámicos y Delegación

Nunca agregar `addEventListener` dentro de un `forEach` al clonar templates — genera memory leaks.

**Patrón correcto:** escuchar al contenedor padre estático y usar `e.target.closest()`:

```javascript
_dom.list.addEventListener('click', (e) => {
    const btnEliminar = e.target.closest('button[data-action="delete-zona"]');
    if (btnEliminar) logic.eliminarZona(btnEliminar.getAttribute('data-code'));

    const btnEditar = e.target.closest('button[data-action="abrir-modal-editar"]');
    if (btnEditar) logic.prepararEdicion(btnEditar.getAttribute('data-id'));
});
```

Los botones en los templates deben tener siempre `data-action` y `data-id` (o `data-code`) para que la delegación funcione sin acoplar la lógica al DOM:

```html
<button class="btn-eliminar" data-action="delete-zona" data-code="TERR">...</button>
```

---

## 🧠 6. Regla de Cero Lógica de Negocio en Render (Diccionarios UI)

El renderizado no toma decisiones. Todas las variaciones visuales se definen en `_uiConfig` dentro de la Sección 2:

```javascript
// ❌ Incorrecto — lógica de negocio en el render
if (item.estado === 'ACTIVO') badge.className = 'bg-emerald-100';
else badge.className = 'bg-red-100';

// ✅ Correcto — lookup directo al diccionario
const clase = _uiConfig.badges[item.estado] || _uiConfig.badges.DEFAULT;
badge.className += ` ${clase}`;
```

El backend no manda clases de Tailwind. El frontend mapea los valores de negocio (`'ACTIVO'`, `'COMPRAR'`, `'pending'`) a clases CSS mediante el diccionario local.

---

## 📋 7. FormEngine: Contrato y Anti-Reset

`bindForm` de `/shared/js/formEngine.js` reemplaza el `addEventListener('submit')` manual. Hace tres cosas automáticamente: previene el `submit` nativo, ejecuta el callback, y limpia el formulario solo si el callback no lanzó error.

```javascript
// Uso estándar
bindForm('form-piso-zona', logic.crearZona);

// El callback NO recibe el evento — solo ejecuta la lógica
const crearZona = async () => {
    const payload = { zoneCode: _dom.inputCode.value.trim() };
    await postData(ENDPOINTS.admin.post.zone, payload);
    showSuccessModal('Zona creada.');
    await logic.cargarDatos();
    // Si llega hasta aquí sin throw, FormEngine limpia el formulario
};
```

### preserveFields — Ráfaga de Captura

Para formularios de data entry masivo donde el usuario repite el mismo campo (ej. siempre la misma categoría, siempre la misma zona), se declara en `ui.rules.js`:

```javascript
// shared/js/ui.rules.js
export const UIRules = {
    'form-piso-mesa': {
        preserveFields: ['mesa-zona-unica'] // El select de zona no se limpia tras guardar
    },
    'form-menu-platillo': {
        preserveFields: ['plat-category']   // La categoría se conserva para entrada rápida
    },
    'form-inv-supplier': {
        preserveFields: []                  // La restauración se hace manual con setTimeout (ver §8)
    }
};
```

> **Regla:** El `id` en `preserveFields` debe coincidir exactamente con el atributo `id` del elemento en el HTML.

---

## ⏱️ 8. Patrón Anti-Reset con setTimeout (50ms)

Cuando `FormEngine` limpia campos que no están en `preserveFields` pero el controlador necesita restaurar un valor de estado (no de formulario), se usa el patrón `setTimeout(fn, 50)`:

```javascript
// Caso: tras guardar un proveedor, queremos que el panel derecho
// muestre el proveedor recién guardado (no la pantalla vacía)
bindForm('form-inv-supplier', async () => {
    const codigo = _dom.inputCode.value.trim();
    await postData(ENDPOINTS.inventory.post.suppliers, payload);

    state.ui.selectedSupplierCode = codigo; // Guardamos en estado ANTES del reset

    setTimeout(() => {
        render.suppliers(); // FormEngine ya limpió el form, ahora re-hidratamos la vista
    }, 50);
});
```

**Cuándo usar este patrón:**
- El campo que queremos preservar **no es un input del formulario** sino un estado interno (`state.ui.*`).
- Necesitamos que FormEngine limpie primero y luego re-apliquemos la vista.

**Cuándo NO usar este patrón:**
- Si el campo a preservar es un `<input>` o `<select>` del mismo formulario → usar `preserveFields`.
- Si queremos re-hidratar datos frescos de la BD → hacer la llamada HTTP directa sin timeout.

---

## 🚦 9. El Orquestador de la Vista (Sub-módulos con PubSub)

Si una pantalla tiene secciones que se afectan mutuamente (ej. Gestión de Piso: crear una zona debe actualizar el selector de zonas en Mesas y en Asignaciones), el `index.js` actúa como orquestador:

```javascript
// views/piso/index.js
import { ZonasController }       from './zonas.js';
import { MesasController }       from './mesas.js';
import { AsignacionesController } from './asignaciones.js';
import { PubSub }                from '/shared/js/pubsub.js';

export const PisoController = {
    mount: async (container) => {
        // 1. Montar todos los submódulos pasando el mismo container
        await Promise.all([
            ZonasController.mount(container),
            MesasController.mount(container),
            AsignacionesController.mount(container)
        ]);

        // 2. Inyección inicial: pasar los datos ya cargados entre módulos
        const zonas = ZonasController.getZonas();
        MesasController.actualizarZonas(zonas);
        AsignacionesController.actualizarZonas(zonas);

        // 3. Orquestar actualizaciones futuras via PubSub
        PubSub.subscribe('ZONAS_ACTUALIZADAS', (zonas) => {
            MesasController.actualizarZonas(zonas);
            AsignacionesController.actualizarZonas(zonas);
        });

        PubSub.subscribe('MESAS_ACTUALIZADAS', (mesas) => {
            AsignacionesController.actualizarMesas(mesas);
        });
    }
};
```

**Regla del orquestador:** el `index.js` no tiene lógica de negocio propia ni accede al DOM directamente. Solo monta submódulos y conecta eventos PubSub. Ver el catálogo completo de eventos en `08_catalogo_eventos_pubsub.md`.