# Guía de Desarrollo End-to-End (E2E) y Convenciones

Este documento define el ciclo de vida completo para la creación de un nuevo módulo o característica en Kore Bar. Cualquier desarrollador que intervenga el código debe seguir este flujo paso a paso para garantizar la escalabilidad y limpieza de la arquitectura.

## 1. Convenciones de Nomenclatura y Configuración

* **Archivos y Carpetas:** `kebab-case` (ej. `gestion-piso`).
* **Controladores JS:** `PascalCase` para el objeto exportado (ej. `EmpleadosController`).
* **IDs y Clases HTML:** `kebab-case` SIEMPRE. (Prefijos `form-`, `btn-`, `tpl-`, `col-`).

**⚠️ REGLA DE ORO: Cero "Magic Strings"**
Está estrictamente prohibido escribir IDs de HTML directamente en los controladores. Todos los IDs de contenedores y plantillas deben registrarse primero en el diccionario central global `shared/js/kore.config.js`.

## 2. Flujo de Trabajo (Paso a Paso)

### Paso 1: Documentar las Reglas de Negocio
Registrar el comportamiento en el archivo `docs/06_matriz_reglas_interaccion_ui.md`.

### Paso 2: El Backend (Schema-Driven Router)
1. Crea/actualiza el modelo de BD.
2. Crea el esquema JSON en `backend/src/engine/schemas/`.
3. Registra la lógica compleja en `src/engine/actionRegistry.js`.

**⚠️ REGLA DE NUEVOS DOMINIOS (MICROSITIOS):**
Si estás creando un módulo para un micrositio completamente nuevo (Ej. Cocina, Meseros, Caja), antes de crear los esquemas debes registrar su enrutador base:
1. Crea el archivo de rutas (Ej. `src/routes/kitchen.routes.js`) instanciando a Hono y llamando a `buildRoutes()`.
2. Monta el enrutador en el archivo principal (`app.js` o `index.js`) con su prefijo correspondiente: `app.route('/api/kitchen', kitchenRouter)`.
3. **Importante:** Los archivos de esquema JSON (`.schema.json`) dentro de ese dominio **NO deben incluir el prefijo base** en su propiedad `"path"` para evitar duplicaciones (Ej. Usar `/ingredients`, no `/kitchen/ingredients`).


### Paso 3: El Frontend - Estructura HTML (`index.html`)
1. Crea el "cascarón" de tu vista usando `<template>`.
2. Registra los IDs nuevos en `kore.config.js`.
3. **REGLA DE ARRANQUE:** Ningún HTML debe invocar su propio script lógico directamente. Al final del `<body>`, debes invocar exclusivamente al orquestador global:
```html
    <script type="module" src="/core/js/kore.core.js"></script>
```

> **Desviaciones formales documentadas — NO replicar en nuevos micrositios:**
>
> - **`waiters.localhost`** — No usa `kore.core.js`. Razón: el Core ejecutaba un doble mount del login al arrancar (race condition con el PubSub de `AUTH_SUCCESS` ya activo). Se bootstrappea directamente con su propio `app.js`. Cualquier intento de migrar de vuelta al Core debe resolver primero esta race condition.
>
> - **`menu.localhost`** — No usa `kore.core.js`. Razón: es un micrositio público de solo lectura sin autenticación, PubSub ni gestión de plantillas. El Core incluye funcionalidad innecesaria que añade complejidad sin beneficio.
>
> Estas desviaciones son intencionales y permanecen hasta que se resuelvan sus causas raíz. Todo micrositio nuevo que requiera auth y navegación entre vistas **debe usar `kore.core.js` sin excepción**.

### Paso 4: El Frontend - Aislamiento de Reglas de Negocio (`/rules/`)

Antes de crear la lógica de la vista, toda regla de negocio compleja (validaciones de integridad, máquinas de estado, comparadores de matrices MDM) **DEBE programarse de forma aislada e inmutable** en la carpeta de reglas correspondiente al micrositio:

* **Ruta Estándar:** `frontends/[nombre_sitio]/js/rules/[modulo].[engine|rules].js`.
* *Ejemplo:* `frontends/admin/js/views/empleados/rules/mdm.engine.js`.

### Paso 5: El Frontend - Controlador JS (Las 7 Secciones)

Aplica el **Patrón de Módulo Revelador en 7 Secciones** para vistas en Vanilla JS (Dependencias, Estado Privado, Caché del DOM, Renderizado, Lógica de Negocio, Eventos y API Pública). Instancia tus motores de reglas en la Sección 2 (Estado Privado).

### Paso 6: Registro y Enrutamiento (`app.js` / `router.js`)

Tu `app.js` local debe contener el diccionario de rutas (Objeto Literal) y escuchar el evento de navegación del `PubSub`, apoyado en las constantes de `KORE_CONFIG`.

**⚠️ REGLA DE NAVEGACIÓN HTML:**
Para que el enrutador escuche los clics del usuario desde el menú lateral o barras de navegación, el HTML debe usar exclusivamente el atributo `data-nav`.
*Correcto:* `<button data-nav="menu">`
*Incorrecto:* `<button data-route="menu">` o `<a href="/menu">`

**⚠️ REGLA DE IMPORTACIÓN DE VISTAS:**
El enrutador debe tratar de manera distinta a las vistas simples (un solo archivo) frente a las vistas complejas (orquestadores).

**A. Para Vistas Simples (Monolíticas):**
Se importa la función `mount` desestructurada y renombrada.
*Ruta:* `import { mount as mountDashboard } from './views/dashboard.js';`
*Invocación:* `mountDashboard(root);`

**B. Para Vistas Complejas (Orquestadores de Submódulos):**
Si la vista tiene múltiples secciones (ej. Gestión de Piso), **no se apunta al archivo `.js` directamente**, se apunta a la carpeta y su `index.js`. Se importa el Controlador completo.
*Ruta:* `import { PisoController } from './views/piso/index.js';`
*Invocación:* `PisoController.mount(root);`

**Ejemplo Estándar del Router (`app.js`):**
```javascript
import { mount as mountDashboard } from './views/dashboard.js'; // Simple
import { PisoController } from './views/piso/index.js';         // Orquestador

const Routes = {
    'dashboard': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.DASHBOARD);
        mountDashboard(root);
    },
    'piso': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.PISO);
        PisoController.mount(root);
    }
};
---