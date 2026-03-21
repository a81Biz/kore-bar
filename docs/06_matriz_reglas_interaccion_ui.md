# Matriz de Reglas de Interacción UI

Este documento es la **Única Fuente de Verdad** para el comportamiento del frontend: normas de arquitectura, reglas de formularios, flujos de validación y la tabla completa de `UIRules`.

Cualquier nueva regla de negocio que modifique la interacción visual debe registrarse aquí antes de codificarse.

---

## Reglas Arquitectónicas Globales (Transversales)

| Elemento | Evento | Regla | Resultado esperado |
|---|---|---|---|
| `<template>` | `render` | **Separación de Vistas:** Prohibido `innerHTML = '<tr>...'` en JS. Las vistas usan templates clonados. | HTML en su archivo; JS en el suyo. |
| Controladores | `render` | **Cero Lógica en UI:** Los condicionales de color/estilo viven en `_uiConfig`, nunca en el render. | Render limpio sin if/else. |
| `http.client.js` | `!response.ok` | **Traducción de Errores:** Toda petición no-200 lanza un `Error` con `jsonResponse.error || message`. El controlador lo captura con `catch` y llama a `showErrorModal(error.message)`. | Modal de error limpio, nunca código HTTP desnudo. |
| `formEngine.js` | `submit` | **Error Preservation:** Si el callback lanza un error, el formulario NO se limpia. Los datos del usuario se conservan. | El usuario puede corregir sin reescribir. |
| `formEngine.js` | `submit` éxito | **Limpieza Selectiva:** FormEngine limpia todos los campos excepto los declarados en `UIRules[formId].preserveFields`. | Ráfaga de captura sin pérdida de contexto. |
| Sidebar / Nav | `click` | **Contrato de Enrutamiento:** Solo `data-nav="[ruta]"` dispara navegación. Prohibido `href`, `data-route` u `onclick`. | El PubSub de NAVIGATE funciona correctamente. |
| `confirmAction` | `click` | **Confirmación de Borrado:** Toda operación destructiva (DELETE) debe llamar a `confirmAction(mensaje)` antes del HTTP. Actualmente usa `window.confirm` — se migrará a modal Tailwind sin cambiar la lógica del controlador. | Prevención de borrados accidentales. |

---

## Tabla Maestra de UIRules (`shared/js/ui.rules.js`)

Esta tabla es la fuente de verdad para lo que `FormEngine` debe preservar después de cada submit exitoso. **Cualquier nuevo formulario que use `bindForm` debe registrarse aquí.**

| `formId` | `preserveFields` | Motivo |
|---|---|---|
| `form-piso-zona` | `[]` | El formulario de zonas se limpia completamente tras guardar. |
| `form-piso-mesa` | `['mesa-zona-unica']` | El selector de zona se conserva para registrar múltiples mesas en la misma zona (ráfaga). |
| `form-piso-asignacion` | `['asig-puesto']` | El puesto se conserva para asignar al siguiente mesero sin reseleccionar. |
| `form-menu-categoria` | `[]` | Las categorías se limpian completamente. |
| `form-menu-platillo` | `['plat-category']` | La categoría se conserva para dar de alta varios platillos del mismo tipo (ráfaga). |
| `form-inv-supplier` | `[]` | La restauración del proveedor activo se maneja con `setTimeout(render.suppliers, 50)` en el controlador, no con preserveFields. |
| `form-supplier-price` | `[]` | Los campos se limpian. El estado del buscador (readOnly/disabled) se restaura manualmente en el controlador. |
| `form-transfer` | `[]` | Modal de traspaso, se limpia completamente al cerrar. |
| `form-adjustment` | `[]` | Modal de ajuste, se limpia completamente al cerrar. |
| `form-edit-empleado` | `[]` | La modal de edición se resetea al cerrar. |
| `form-review-comercial` | `[]` | El drawer de revisión se resetea al cerrar. |
| `form-kitchen-ingredient` | `[]` | El formulario de nuevo ingrediente se limpia completamente tras guardar. |
| `form-tech-sheet` | `['tech-dish-code']` | El código del platillo se conserva para poder añadir múltiples ingredientes a la misma ficha técnica (ráfaga). |

> **Regla de IDs:** El valor en `preserveFields` debe ser el `id` HTML exacto del elemento. Verificar en el partial correspondiente antes de declararlo.

---

## Reglas por Micrositio

### Micrositio: Administración (`admin.localhost`)

#### Módulo: Gestión de Piso

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#form-piso-zona` | `submit` | **Unicidad en BD:** El backend rechaza duplicados con 23505 → el helper traduce a 400 → `http.client` lanza error → `showErrorModal`. | Modal: "El código de zona ya existe". |
| `#form-piso-zona` | `submit` éxito | **PubSub ZONAS_ACTUALIZADAS:** Tras guardar, `logic.cargarDatos()` publica el evento para que Mesas y Asignaciones actualicen sus selectores. | Re-hidratación sin F5. |
| `#form-piso-mesa` | `submit` | **Zona Requerida:** Si `#mesa-zona-unica` está vacío, el controlador lanza error antes del HTTP. | Modal: "Debes seleccionar una Zona". |
| `#form-piso-mesa` | `submit` | **Ráfaga de Captura:** `mesa-zona-unica` se preserva vía `UIRules`. | El select de zona no se limpia. |
| `#form-piso-mesa` | `submit` | **PubSub MESAS_ACTUALIZADAS:** Tras guardar, el controlador publica para que Asignaciones recalcule el PAX del resumen. | Tabla resumen actualizada. |
| `#mesa-zona-unica` | `change` | **Filtro Dinámico:** La lista de mesas se re-renderiza mostrando solo las de la zona seleccionada. | Actualización inmediata en memoria. |
| `#form-piso-asignacion` | `submit` | **Anti-Colisión Local (JS):** El `ValidatorEngine` evalúa `colisionTurnos` antes del HTTP. | Modal de error inmediato sin gastar BD. |
| `#form-piso-asignacion` | `submit` | **Anti-Colisión en BD (PostgreSQL):** Si la validación local pasa pero la BD rechaza (409), `showErrorModal` muestra el mensaje del servidor. | Doble capa de protección. |
| `#filtro-fecha-asig` | `load` | **Bloqueo del Pasado:** El atributo `min` se asigna a la fecha de hoy en `render.cacheDOM`. | No se pueden crear asignaciones en el pasado. |
| `#asig-puesto` | `change` | **Cascada de Empleados:** Al cambiar el puesto, `#asig-mesero` se re-hidrata solo con empleados activos de ese puesto. | Filtro orgánico de personal. |

#### Módulo: Gestión de Empleados

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#btn-hr-sync` | `click` | **Loading State:** El botón se deshabilita y muestra "⏳ Sincronizando..." durante el proceso. Se restaura al finalizar. | Previene multi-clicks. |
| `#form-hr-sync` | `submit` | **Anti-Reset Manual:** Este formulario NO usa `bindForm` para evitar que la URL del JSON se borre. El submit se maneja con `addEventListener` directo. | La URL permanece visible para el usuario. |
| `#edit-emp-area` | `change` | **Cascada de Puestos:** Al cambiar el área, `#edit-emp-puesto` se re-hidrata con todos los puestos del catálogo. | Selector de puestos actualizado. |
| Modal Edición | `open` | **Hidratación de Estado:** El toggle `#edit-emp-active` refleja el `is_active` real del empleado en BD. | Toggle ON/OFF correcto. |
| `MDMEngine` | `syncHR` | **Ciclo de Reconciliación:** La lógica de sincronización aplica la Matriz MDM (ver `06b` abajo). Los empleados con `syncState: 'pending'` se muestran con badge amarillo pero NO se guardan automáticamente. | El gerente controla el guardado masivo. |
| `#btn-save-all` | `click` | **Guardado Masivo:** Solo visible cuando `syncStats.pending > 0`. Llama a `bulkEmployees` con todos los pendientes en una transacción. | Un solo POST salva todos. |

**Matriz MDM — Estados de Sincronización:**

| Llave (`ACCION_HR | ESTADO_BD | FECHA`) | Veredicto | `syncState` |
|---|---|---|
| `ALTA\|NULL\|NEWER` | CREATE | `pending` |
| `ALTA\|ACTIVO\|NEWER` | UPDATE | `pending` |
| `ALTA\|ACTIVO\|SAME` | IGNORE | `saved` |
| `ALTA\|ACTIVO\|OLDER` | REJECT | `error` |
| `ALTA\|INACTIVO\|NEWER` | REACTIVATE | `pending` |
| `ALTA\|INACTIVO\|SAME` | IGNORE | `saved` |
| `ALTA\|INACTIVO\|OLDER` | REJECT | `error` |
| `BAJA\|ACTIVO\|ANY` | DEACTIVATE | `pending` |
| `BAJA\|INACTIVO\|ANY` | IGNORE | `saved` |
| `BAJA\|NULL\|ANY` | REJECT | `error` |
| `NONE\|ACTIVO\|ANY` | FLAG | `orphan` |
| `NONE\|INACTIVO\|ANY` | IGNORE | `saved` |

#### Módulo: Gestión de Menú

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#form-menu-categoria` | `submit` | **PubSub CATEGORIAS_ACTUALIZADAS:** Al crear o borrar una categoría, se publica el evento para que el módulo de Platillos actualice sus selectores. | Sincronía entre columnas. |
| `#form-menu-platillo` | `submit` | **Ráfaga de Captura:** `plat-category` se preserva vía `UIRules`. | La categoría no se borra entre platillos. |
| `#form-menu-platillo` | `submit` | **Anti-Colisión Local:** El `ValidatorEngine` verifica `codigoDuplicado` contra el array en memoria antes del HTTP. | Error inmediato sin ir a la BD. |
| `#filtro-platillo-categoria` | `change` | **Filtro en Memoria:** La lista se filtra evaluando el array `_datos.platillos` local, sin nueva consulta HTTP. | Filtrado en 0ms. |
| `#form-review-comercial` | `submit` | **Candado Comercial:** Admin puede cambiar nombre, precio, descripción e imagen. No puede tocar cantidades de la receta — ese campo solo existe en el módulo de Cocina. | Protección del Kardex. |
| `#rev-img-upload` | `change` | **Previsualización Local + Compresión WebP:** Al seleccionar imagen, se comprime con `compressImageToWebP(file, 800, 0.75)` y se muestra preview inmediato. El Base64 se guarda en `state.datos.currentImageBase64`. | Feedback visual instantáneo sin subir a servidor. |
| Smart Delete (categoría) | `DELETE` | **Protección Relacional:** Si la categoría tiene platillos activos, la BD devuelve P0001 → el helper traduce a 409 → `showErrorModal`. | Modal: "No se puede borrar, tiene platillos activos". |

#### Módulo: Inventario y Proveedores

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#btn-sync-purchases` | `click` | **Loading State:** El botón se deshabilita, el ícono rota con `animate-spin` y el texto cambia. Se restaura en `finally`. | Previene multi-clicks corruptores. |
| `#btn-sync-purchases` | `load`/`change` de `#stock-location-filter` | **Visibilidad Contextual:** El botón solo es visible (`display: flex`) cuando el filtro de ubicación apunta a `LOC-BODEGA`. | Impide PULLs a ubicaciones sin destino seguro. |
| `#link-item-code` | `blur` | **Autocompletado Híbrido:** Si el código existe en `state.data.stock`, se autocompletan nombre y unidad y se bloquean (`readOnly`). Si no existe, se deja abierto para crear nuevo insumo. | Cero interrupciones para el gerente. |
| `#form-inv-supplier` | `submit` éxito | **Anti-Reset con setTimeout:** Se guarda `state.ui.selectedSupplierCode = codigo` antes del reset, luego `setTimeout(render.suppliers, 50)` re-hidrata la vista con el proveedor activo. | El panel derecho no queda vacío. |
| `#modal-transfer` | `open` | **Smart Disable:** La opción del `<select>` destino que coincide con la ubicación origen se deshabilita (`opt.disabled = true`). | Impide traspaso de A → A. |
| `#modal-adjustment` | `open` | **Shadow Stock:** Se expone el `data-stock` actual junto al input del stock físico real para reducir fatiga cognitiva. | El gerente ve el teórico vs el real de un vistazo. |
| `#table-kardex` | `render` | **Inmutabilidad:** El Kardex no tiene botones de editar ni eliminar. Es solo lectura auditable. | Cumplimiento contable. |
| `ValidatorEngine` | `saveAdjustment` | **Bloqueo de Stock Negativo:** Si la merma es mayor al stock teórico en memoria, se bloquea antes del HTTP. | Previene -5 tomates. |

---

### Micrositio: POS Mesero (`waiters.localhost`)

#### Módulo: Login

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#form-waiter-login` | `submit` | **PIN de 4-6 dígitos:** Solo numérico. El Gatekeeper del backend rechaza con 400 si falta `employeeNumber` o `pin`. | Error modal si el payload está incompleto. |
| `#form-waiter-login` | `submit` | **PIN Incorrecto:** El backend devuelve 401. El frontend muestra modal de error sin revelar si el número de empleado existe o no. | Seguridad ante enumeración. |

#### Módulo: Layout de Piso

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#layout-container` | `load` | **Solo Lectura:** El mesero solo ve el estado de las mesas (AVAILABLE / OCCUPIED). No puede crear ni borrar mesas desde esta vista. | Separación de roles. |
| `.btn-mesa` | `click` | **Navegación Contextual:** Al tocar una mesa AVAILABLE se va a "Abrir Mesa". Al tocar OCCUPIED se va a "Ver Comanda". | UX optimizada para tableta. |

#### Módulo: Comanda

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#form-open-table` | `submit` | **Idempotencia:** Si la mesa ya tiene orden OPEN, el backend devuelve el `orderCode` existente en lugar de crear uno nuevo. | Apertura segura sin duplicados. |
| `#form-submit-order` | `submit` | **Items Mínimos:** Si `items.length === 0`, el backend rechaza con 400. Validar en frontend antes del HTTP. | No se envían comandas vacías. |
| `.btn-collect` | `click` | **Con Body (`employeeNumber`):** El endpoint `PUT /collect` requiere `{ employeeNumber }` para llamar al SP `sp_pos_collect_item`. El Gatekeeper rechaza con 400 si falta el campo. | El SP necesita el código del mesero para registrar quién recogió el platillo. |
| `.btn-deliver` | `click` | **Sin Body:** El endpoint `PUT /deliver` no acepta body. El frontend NO debe enviar `employeeNumber` ni ningún otro campo — el Gatekeeper Zero Trust rechaza con 400 cualquier payload. Usar `fetch` sin `body`. | El deliver solo avanza el estado; el SP no requiere identificación adicional. |
| `#form-close-table` | `submit` | **Solo empleado:** El cierre envía solo `employeeNumber`. No acepta `paymentMethod` — el pago lo procesa exclusivamente la Caja. | Separación de responsabilidades Mesero / Caja. |

---

### Micrositio: Caja (`cashier.localhost`)

#### Módulo: Login Cajero

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#form-cashier-login` | `submit` | **Área con Permiso:** Solo los empleados cuya área tiene `can_access_cashier = true` aparecen en el selector. | Filtro de elegibilidad. |
| `#form-cashier-login` | `submit` | **PIN Incorrecto:** 401 del servidor → `showErrorModal`. | Sin revelación de datos. |

#### Módulo: Tablero de Caja

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#board-container` | `load` | **Solo AWAITING_PAYMENT:** El tablero solo muestra mesas en estado `AWAITING_PAYMENT`. Las mesas OPEN no son visibles para la caja. | El cajero solo atiende lo que está listo para pagar. |
| `.btn-pay` | `click` | **Métodos de Pago Mixtos:** El payload acepta un array `payments: [{method, amount}]` para splits. La suma de `amount` debe cubrir el total. | Pago dividido entre efectivo y tarjeta. |
| `#form-payment` | `submit` | **`payments` Requerido:** El Gatekeeper rechaza con 400 si falta el array. Validar en frontend antes del HTTP. | No se procesa pago sin método. |
| Folio generado | tras pago | **Formato TKT-:** El folio devuelto siempre empieza con `TKT-`. Verificar con `/^TKT-/` antes de mostrarlo. | Consistencia visual. |

#### Módulo: Tickets y Corte Z

| Elemento (ID) | Evento | Regla | Resultado |
|---|---|---|---|
| `#form-ticket-search` | `submit` | **Folio Inexistente:** El backend devuelve 404. Mostrar modal de error claro. | Sin pantalla en blanco. |
| `#btn-corte-z` | `click` | **Solo Lectura:** El corte Z es un resumen del día en curso. No tiene acciones de edición. | Registro auditable. |