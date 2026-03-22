## Actores del Sistema

| ID | Actor | Tipo | Micrositio |
|---|---|---|---|
| A-01 | **Administrador / Gerente** | Primario interno | `admin.localhost` |
| A-02 | **Mesero / Capitán / Runner** | Primario interno | `waiters.localhost` |
| A-03 | **Chef / Cocinero** | Primario interno | `kitchen.localhost` |
| A-04 | **Cajero** | Primario interno | `cashier.localhost` |
| A-05 | **Comensal** | Primario externo | `menu.localhost` |
| A-06 | **Sistema de RRHH (HR)** | Secundario externo | API / Webhook JSON |
| A-07 | **API SAT / PAC** | Secundario externo | `invoice.localhost` |

---

## Resolución de Solapamientos (Auditoría v1.0)

Antes de listar los CUs, se documentan las cinco colisiones encontradas y
su resolución definitiva para evitar confusión futura.

| # | CUs involucrados | Problema | Resolución |
|---|---|---|---|
| S-01 | `CU-COC-03` (BOM en Cocina) vs `CU-MENU-03` en Gestión de Platillos | Mismo proceso, actores distintos | **Mantener ambos.** CU-COC-04 = Chef construye receta desde `kitchen.localhost`. CU-MENU-07 = Gerente revisa el resultado en `admin.localhost`. Son fases distintas del mismo flujo. |
| S-02 | `CU-COMP-01` (Algoritmo de Sugerencia en CU Gestión de Platillos) vs `CU-COC-11` (Cocina) vs `CU-INV-11` (Inventario) | Mismo algoritmo en tres fuentes | **Sobrevive `CU-INV-11`.** `CU-COMP-01` y `CU-COC-11` quedan como referencias: *"ver CU-INV-11"*. El algoritmo vive en `sp_sync_purchases` y pertenece al módulo de Inventario. |
| S-03 | `CU-INS-01` / `CU-INS-02` (Gestión de Platillos) vs `CU-COC-02` / `CU-COC-03` (Cocina) | Alta de insumos en dos documentos | **El Chef da de alta insumos desde `kitchen.localhost` (CU-COC-02/03). El Admin los ve de solo-lectura.** Se eliminan `CU-INS-01` y `CU-INS-02` como entrada de Admin; el Admin registra insumos indirectamente vía Sincronización de Compras (`CU-INV-06`). |
| S-04 | `CU-COMP-02` (Órdenes de Compra en Gestión de Platillos) vs `CU-INV-06` + `sp_sync_purchases` | Proceso de compra en tres fuentes | **Sobrevive `CU-INV-06`.** `CU-COMP-02` queda como referencia: *"ver CU-INV-06"*. |
| S-05 | `CU-INS-03` (Ajuste en Gestión de Platillos) vs `CU-INV-07` (CU Inventario) | Mismo CU en dos documentos | **Sobrevive `CU-INV-07`.** `CU-INS-03` queda eliminado con nota de redirección. |

---

## MÓDULO 1 — Gestión de Piso
**Actor principal:** A-01 (Administrador)

### Grupo Z — Zonas

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-Z01 | Crear Zona | El Admin ingresa un código único (`TERR`) y un nombre descriptivo (`Terraza VIP`). El sistema guarda la zona activa. | Usuario autenticado como Admin | Zona activa registrada; selector de zonas en Mesas y Asignaciones se actualiza vía PubSub `ZONAS_ACTUALIZADAS` |
| CU-Z02 | Crear Zona con código duplicado | El Admin intenta crear una zona con un `zoneCode` que ya existe. El backend devuelve error 23505 → el helper traduce a 400 → modal de error. | Zona con ese código ya existe en BD | Sin cambios en BD; modal muestra "El código de zona ya existe" |
| CU-Z03 | Editar nombre de Zona | El Admin modifica el nombre descriptivo de una zona existente sin alterar su código. | Zona existe y está activa | Nombre actualizado; UI refleja cambio inmediato |
| CU-Z04 | Borrar Zona sin historial (Hard Delete) | El Admin elimina una zona recién creada sin mesas asignadas. El SP detecta antigüedad < 1h y ejecuta `DELETE`. | Zona sin mesas activas y antigüedad < 1h | Zona eliminada físicamente de la BD |
| CU-Z05 | Borrar Zona con historial (Soft Delete) | El Admin elimina una zona con historial operativo. El SP detecta antigüedad > 1h y ejecuta `is_active = false`. | Zona sin mesas activas y antigüedad > 1h | Zona marcada inactiva; no aparece en selectores pero preserva historial |
| CU-Z06 | Borrar Zona con mesas activas | El Admin intenta borrar una zona que contiene mesas activas. El SP lanza error `P0001`. | Zona tiene mesas con `is_active = true` | Sin cambios; modal muestra "La zona tiene mesas activas" |

### Grupo M — Mesas

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-M01 | Crear Mesa | El Admin selecciona una zona activa, ingresa un ID de mesa (`T-01`) y su capacidad (4 pax). El sistema la registra. | Zona activa seleccionada | Mesa registrada; lista de mesas actualizada; PubSub `MESAS_ACTUALIZADAS` disparado |
| CU-M02 | Crear Mesa con zona inválida | El Admin intenta asignar una mesa a una zona inactiva o inexistente. El SP lanza `P0002`. | Zona no existe o `is_active = false` | Sin cambios; modal de error |
| CU-M03 | Editar Mesa | El Admin modifica la capacidad de una mesa o la reubica a otra zona. | Mesa existe y está activa | Mesa actualizada; resumen operativo recalcula PAX |
| CU-M04 | Borrar Mesa sin comandas (Hard Delete) | El Admin elimina una mesa sin historial de ventas. El SP hace `DELETE`. | Mesa sin órdenes históricas | Mesa eliminada físicamente |
| CU-M05 | Borrar Mesa con historial (Soft Delete) | El Admin elimina una mesa con ventas pasadas. El SP hace `is_active = false`. | Mesa con órdenes históricas | Mesa marcada inactiva; reportes financieros intactos |

### Grupo A — Asignaciones

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-A01 | Crear Asignación para un día | El Admin selecciona puesto → empleado → zona → turno → fecha y confirma. `sp_create_assignment` inserta el registro. | Empleado activo; zona activa; fecha ≥ hoy | Asignación guardada; empleado aparece en login de `waiters.localhost` ese día |
| CU-A02 | Colisión de empleado en dos zonas | El Admin intenta asignar al mismo empleado a dos zonas en el mismo turno y fecha. El ValidatorEngine JS lo bloquea antes del HTTP. | Empleado ya tiene asignación en ese turno/fecha | Sin cambios en BD; modal "El mesero ya tiene una zona asignada en este turno" |
| CU-A03 | Reasignar empleado a otra zona | El Admin actualiza la asignación de un empleado moviéndolo a una zona diferente para el mismo turno. | Asignación existente | Asignación actualizada; PubSub notifica cambio |
| CU-A04 | Eliminar asignación futura | El Admin retira a un empleado de un turno futuro (ej. falta por enfermedad). `sp_delete_assignment` hace Hard Delete. | Asignación existe con fecha futura | Registro eliminado; empleado no aparece en POS ese día |
| CU-A05 | Crear Asignación recurrente (Semana o Mes) | El Admin selecciona recurrencia "Semana" o "Mes". El sistema genera un arreglo de fechas y valida colisiones en todos los días antes de guardar. `sp_create_assignment_range` inserta el bloque completo. | Ningún día del bloque tiene colisión | Todas las asignaciones del bloque guardadas en un solo POST |
| CU-A06 | Bloque recurrente con colisión parcial — Todo o Nada | El Admin crea una asignación semanal pero uno de los días tiene colisión. El sistema rechaza **todo el bloque**; no guarda los días válidos parcialmente (R-COL-03). | Al menos un día del bloque tiene colisión | Sin cambios en BD; modal indica el día específico con conflicto |

---

## MÓDULO 2 — Gestión de Empleados y RRHH
**Actor principal:** A-01 (Administrador), A-06 (Sistema HR)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-HR-01 | Sincronizar plantilla desde JSON de RRHH | El Admin ingresa la URL del archivo JSON de RRHH y presiona "Sincronizar". El sistema hace PULL, parsea el JSON, ejecuta el ciclo de reconciliación MDM sobre cada registro y presenta el resultado en pantalla. | URL accesible; JSON válido con array de empleados | Tabla de directorio actualizada con badges de estado (Al Día / Falta Guardar / Huérfano) |
| CU-HR-02 | Reconciliar empleado nuevo (CREATE) | El JSON trae un empleado con `action: alta` que no existe en BD. El MDMEngine decide `CREATE`. El empleado aparece en la tabla con badge "Falta Guardar" (`isDraft: true`). | Empleado no existe en BD | Registro en memoria listo para edición y guardado manual |
| CU-HR-03 | Reconciliar actualización de datos (UPDATE) | El JSON trae un empleado existente con `action: alta` y fecha más reciente que la BD. MDMEngine decide `UPDATE`. Badge "Falta Guardar". | Empleado existe en BD y la fecha HR es más nueva | Datos mezclados (merge) en memoria; pendiente de confirmación |
| CU-HR-04 | Ignorar registro idéntico (IGNORE) | El JSON trae un empleado existente con la misma fecha que BD. MDMEngine decide `IGNORE`. Badge "Al Día". | Fechas idénticas entre HR y BD | Sin cambios; registro marcado como `saved` |
| CU-HR-05 | Reactivar empleado dado de baja (REACTIVATE) | El JSON trae un `action: alta` para un empleado con `is_active = false` en BD y fecha más reciente. MDMEngine decide `REACTIVATE`. Badge "Falta Guardar". | Empleado existe pero `is_active = false` | Registro en memoria con `is_active = true`; pendiente de confirmación |
| CU-HR-06 | Rechazar reingreso inválido (REJECT) | El JSON trae datos más antiguos que la BD para un empleado existente. MDMEngine decide `REJECT`. El registro de BD se preserva sin cambios. | Fecha en JSON es anterior a la fecha en BD | Registro de BD intacto; log de advertencia visible en consola |
| CU-HR-07 | Detectar empleado huérfano (FLAG) | El JSON de RRHH no incluye a un empleado que sí está activo en BD. MDMEngine decide `FLAG`. Badge "Huérfano / Baja". | Empleado activo en BD pero ausente del JSON | Registro marcado `orphan`; el gerente decide si dar de baja manualmente |
| CU-HR-08 | Editar empleado individualmente | El Admin abre el modal de edición de un empleado, cambia su Área, Puesto o estado Activo/Inactivo, y guarda. Si es borrador (`isDraft`), se llama a `POST /employees`; si ya existe, a `PUT /employees/:id`. | Empleado en tabla (borrador o existente) | Empleado guardado en BD; badge cambia a "Al Día" |
| CU-HR-09 | Guardar masivamente todos los pendientes | El Admin presiona "Guardar Todos" cuando hay registros con badge "Falta Guardar". El sistema hace un único `POST /employees/bulk` con todos los pendientes en una sola transacción. | Al menos un registro con `_syncState: pending` | Todos los pendientes guardados en BD en una transacción; badges cambian a "Al Día" |
| CU-HR-10 | Dar de baja a empleado (Soft Delete) | El Admin abre el modal de edición y desactiva el toggle "Empleado Activo". Al guardar, `sp_deactivate_employee` pone `is_active = false` en `employees` y `system_users`. | Empleado activo en BD | Empleado inactivo; no aparece en login de ningún micrositio; historial de ventas preservado |
| CU-HR-11 | Validar datos vitales faltantes (EMP-06) | El JSON trae un registro sin `employee_number` o sin `first_name`. El ValidatorEngine lo descarta silenciosamente y lo agrega al log de errores sin detener el lote. | Registro con campos obligatorios vacíos | Registro ignorado; resto del lote continúa procesándose |
| CU-HR-12 | Detectar duplicidad en el mismo lote (EMP-05) | El JSON trae dos registros con el mismo `employee_number`. El sistema detecta la colisión en memoria, rechaza el segundo registro y lanza alerta "Datos de origen corruptos". | Dos registros con mismo ID en el mismo JSON | Solo el primer registro se procesa; alerta visible en consola y UI |

---

## MÓDULO 3 — Turnos y Asistencia
**Actor principal:** A-01 (Administrador)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-TRN-01 | Crear Turno en el catálogo | El Admin define un código (`MATUTINO`), nombre descriptivo, hora de inicio y hora de fin. `sp_create_shift` inserta el turno. | Código de turno no existente | Turno disponible en el catálogo; aparece en selector de Asignaciones de Piso |
| CU-TRN-02 | Intentar crear Turno con código duplicado | El Admin intenta registrar un turno con un código ya existente. `sp_create_shift` lanza excepción. | Turno con ese código ya existe | Sin cambios; modal de error "El código de turno ya existe" |
| CU-TRN-03 | Ver Monitor de Asistencia en Vivo | El Admin abre la pestaña "Monitor en Vivo". El sistema cruza `restaurant_assignments` con `attendance_records` vía `vw_attendance_monitor` y muestra el estado de cada empleado asignado al día seleccionado. | Asignaciones registradas para la fecha | Tabla con columnas: Empleado, Turno, Zona, Horario, Estado (PRESENTE / ESPERADO / AUSENTE), hora de Check-in y fuente (WAITERS / CASHIER / KITCHEN) |
| CU-TRN-04 | Consultar Historial de Asistencia | El Admin selecciona rango de fechas y opcionalmente filtra por número de empleado. El sistema devuelve los registros de `attendance_records` cruzados con asignaciones para ese período. | Rango de fechas seleccionado | Tabla histórica de asistencia filtrada; exportable para nómina |
| CU-TRN-05 | Registrar Check-in automático al primer login | Al validar el PIN por primera vez en el día en cualquier micrositio operativo, `sp_record_attendance` inserta un registro en `attendance_records` con la fuente (WAITERS / CASHIER / KITCHEN) y la fecha actual. El SP es idempotente: el segundo login del día no genera un segundo registro. | Empleado con asignación activa para la fecha | Registro en `attendance_records`; Monitor muestra "PRESENTE" con hora exacta |
| CU-TRN-06 | Restablecer PIN de empleado (Planchado) | El Admin ingresa el número de empleado, el nuevo PIN (4–6 dígitos numéricos) y lo confirma. El sistema confirma la acción, llama a `sp_reset_employee_pin` y sobrescribe el PIN anterior. | Empleado existe y está activo | PIN actualizado inmediatamente; el empleado puede ingresar con el nuevo PIN en su próximo login |
| CU-TRN-07 | Intentar restablecer PIN con valores no coincidentes | El Admin ingresa un PIN y su confirmación con valores distintos. El ValidatorEngine JS bloquea el envío antes del HTTP. | — | Sin cambios en BD; modal "Los PINs no coinciden" |

---

## MÓDULO 4 — Gestión de Menú (Admin)
**Actor principal:** A-01 (Administrador)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-MENU-01 | Crear Categoría | El Admin ingresa un código (`BEB`) y un nombre (`Bebidas`). `sp_create_menu_category` inserta el registro. | Código no duplicado | Categoría activa; PubSub `CATEGORIAS_ACTUALIZADAS` notifica a Platillos |
| CU-MENU-02 | Crear Categoría con código duplicado | El Admin intenta crear una categoría con código ya existente. El ValidatorEngine JS lo bloquea en memoria antes del HTTP. | Categoría con ese código visible en tabla | Sin cambios; modal "El código ya existe" |
| CU-MENU-03 | Eliminar Categoría sin platillos activos | El Admin borra una categoría vacía. `sp_delete_menu_category_smart` decide Hard o Soft Delete según antigüedad. | Categoría sin platillos activos | Categoría eliminada o desactivada según antigüedad |
| CU-MENU-04 | Intentar eliminar Categoría con platillos activos | El Admin intenta borrar una categoría que tiene platillos activos. El SP lanza `P0001`. | Categoría con ≥ 1 platillo activo | Sin cambios; modal "No se puede borrar, tiene platillos activos" |
| CU-MENU-05 | Dar de alta Platillo (cascarón comercial) | El Admin ingresa código, categoría, nombre, descripción y precio. `sp_create_menu_dish` crea el platillo con `has_recipe = false` y estado "Pendiente de Receta". | Categoría activa seleccionada; código no duplicado | Platillo visible en lista con badge "Sin Receta"; aparece en Bandeja de Cocina |
| CU-MENU-06 | Crear Platillo con código duplicado | El Admin ingresa un código que ya existe en la tabla en memoria. El ValidatorEngine JS bloquea antes del HTTP. | Platillo con ese código visible | Sin cambios; modal "El código del platillo ya existe" |
| CU-MENU-07 | Revisión Comercial de Platillo (Candado) | El Admin abre el drawer de revisión de un platillo terminado por Cocina. Puede editar nombre, descripción, precio, categoría, estado activo e imagen. **No puede** ver ni modificar las cantidades de ingredientes del BOM. `sp_update_menu_dish` actualiza solo los campos comerciales. | Platillo con `has_recipe = true` | Platillo actualizado comercialmente; imagen reemplazada si se subió una nueva |
| CU-MENU-08 | Reemplazar fotografía del platillo | Desde el drawer de revisión, el Admin sube una imagen. El sistema la comprime a WebP (800px, calidad 0.75) via `compressImageToWebP()`, genera un Base64 y lo guarda como `image_url`. | Platillo en revisión | Imagen actualizada; preview visible inmediatamente sin recargar página |
| CU-MENU-09 | Eliminar Platillo | El Admin confirma la eliminación. `sp_delete_menu_dish_smart` decide Hard o Soft Delete según antigüedad. | Platillo existe | Platillo eliminado o desactivado |
| CU-MENU-10 | Activar / Desactivar Platillo | El Admin cambia el toggle "Platillo Activo en Menú" desde el drawer de revisión y guarda. El platillo deja de aparecer en el menú QR y en el POS del mesero sin ser eliminado. | Platillo existe | `is_active` actualizado; visibilidad en menú digital cambia en tiempo real |

---

## MÓDULO 5 — Ingeniería de Menú (Cocina)
**Actor principal:** A-03 (Chef / Cocinero)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-COC-01 | Ver Bandeja de Platillos Pendientes | Al cargar el módulo de Recetas, el Chef ve la lista de platillos con `has_recipe = false`. La columna izquierda está en Estado Cero (Laboratorio deshabilitado) hasta seleccionar un platillo. | Al menos un platillo sin receta | Lista de pendientes visible; Laboratorio bloqueado |
| CU-COC-02 | Buscar Insumo existente (buscador híbrido) | El Chef escribe el código del insumo en `#ing-code` y lo pierde foco (`blur`). Si el código existe en caché, el sistema autocompleta nombre y unidad y los bloquea (`readOnly`). | Insumo existente en catálogo | Campos autoccompletados y bloqueados; foco salta a Cantidad |
| CU-COC-03 | Dar de alta Insumo nuevo | El Chef escribe un código que no existe en caché. El sistema habilita nombre y unidad para captura. Al añadir, `sp_create_ingredient` hace UPSERT en `inventory_items`. | Código no existe en catálogo | Insumo creado; disponible para futuras recetas |
| CU-COC-04 | Construir Receta Base (BOM) | El Chef añade insumos con cantidades exactas al platillo seleccionado. Cada adición llama a `sp_add_recipe_item` que hace UPSERT en `dish_recipes`. | Platillo seleccionado en Bandeja | BOM actualizado; tabla de ingredientes visible en Laboratorio |
| CU-COC-05 | Actualizar cantidad de insumo en receta (Upsert visual) | El Chef intenta añadir un insumo que ya está en la tabla. En lugar de duplicar, el sistema sobrescribe la cantidad en la fila existente (ON CONFLICT DO UPDATE). | Insumo ya presente en tabla del BOM | Cantidad actualizada sin duplicar fila |
| CU-COC-06 | Cargar foto de emplatado de referencia | El Chef sube la fotografía del platillo terminado. La imagen se guarda como `image_url` en `menu_dishes`. | Platillo con BOM ≥ 1 ingrediente | Foto guardada; visible en revisión comercial del Gerente |
| CU-COC-07 | Marcar Platillo como Terminado (Hand-off) | El Chef presiona "Marcar como Terminado". El sistema: elimina el platillo de la Bandeja, vacía el Laboratorio, aplica Estado Cero y notifica al Admin que puede hacer la revisión comercial. | BOM con ≥ 1 ingrediente | `has_recipe = true`; platillo visible en Admin con badge "Con Receta" |
| CU-COC-08 | Intentar terminar Platillo con receta vacía | El Chef presiona "Marcar como Terminado" con la tabla de ingredientes vacía. El botón permanece `disabled` mientras no haya al menos 1 ingrediente. | Tabla de BOM con 0 ingredientes | Botón bloqueado; sin llamada HTTP |

---

## MÓDULO 6 — KDS (Pizarra de Cocina en Tiempo Real)
**Actor principal:** A-03 (Chef / Cocinero)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-COC-09 | Login de Cocinero con PIN + Check-in automático | El cocinero ingresa su número de empleado y PIN en `kitchen.localhost`. El sistema valida con `fn_get_user_for_pin`, autoriza el acceso y llama a `sp_record_attendance` con `source = KITCHEN`. | Empleado activo con PIN válido | Sesión activa en KDS; Check-in registrado automáticamente |
| CU-COC-10 | Recibir Comandas en tiempo real | Cuando un mesero envía una orden con platillos `has_recipe = true`, el servidor emite un evento WebSocket al KDS. La tarjeta aparece en la columna "Pendiente" ordenada cronológicamente. | Conexión WebSocket activa | Tarjeta de comanda visible con Mesa, Hora, Mesero y lista de platillos |
| CU-COC-11 | Ver detalle de Comanda (Modal) | El Chef toca una tarjeta. Se abre un modal con el desglose completo: número de comensales, platillos, cantidades y notas especiales (términos, alergias). | Tarjeta en columna Pendiente o En Preparación | Modal visible; no cambia el estado del ítem |
| CU-COC-12 | Avanzar platillo a "En Preparación" | El Chef presiona "Preparar". `sp_kds_set_preparing` actualiza `order_items.status = PREPARING` y registra `started_at`. La tarjeta pasa a la columna central con cronómetro activo. | Ítem en estado `PENDING_KITCHEN` | Estado = PREPARING; cronómetro visible; tarjeta cambia de color si excede tiempo estándar |
| CU-COC-13 | Marcar Platillo como Listo | El Chef presiona "Listo". `sp_kds_set_ready` actualiza `order_items.status = READY`. El servidor envía notificación Push a la tablet del mesero asignado. En este momento se descuenta el inventario teórico de `LOC-COCINA` vía Kardex. | Ítem en estado `PREPARING` | Estado = READY; inventario de cocina actualizado; mesero notificado |
| CU-COC-14 | Fin de Turno en Cocina | El Jefe de Cocina presiona "Fin de Turno". El sistema bloquea la entrada de nuevas comandas al KDS y habilita la pantalla de Inventario Ciego para el conteo físico. | Turno activo en Cocina | KDS bloqueado; módulo de Conteo Físico habilitado |

---

## MÓDULO 7 — Inventario y Proveedores (Admin)
**Actor principal:** A-01 (Administrador), A-03 (Chef como solicitante)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-INV-01 | Dar de alta Proveedor | El Admin ingresa código único (`PROV-CARNES`), razón social y datos de contacto. `sp_create_supplier` inserta el registro. | Código no existente | Proveedor activo en catálogo |
| CU-INV-02 | Crear Proveedor con código duplicado | El Admin intenta registrar un proveedor con código ya visible en el listado. El ValidatorEngine JS bloquea antes del HTTP. | Proveedor con ese código en tabla | Sin cambios; modal "El código ya existe en el catálogo" |
| CU-INV-03 | Vincular Insumo a Proveedor con precio pactado | El Admin selecciona un proveedor activo, ingresa código de insumo, nombre, unidad y costo. Si el insumo ya existe, autocompleta nombre y unidad (bloqueados). `sp_upsert_supplier_price` hace UPSERT. | Proveedor guardado seleccionado | Insumo vinculado; precio visible en tabla del panel derecho |
| CU-INV-04 | Autocompletar Insumo existente (buscador híbrido) | Al perder foco en `#link-item-code`, si el código existe en el arreglo local `state.data.stock`, el sistema rellena nombre y unidad automáticamente y los bloquea para evitar edición accidental. | Insumo registrado previamente | Campos autocompletados y bloqueados; foco salta a Precio |
| CU-INV-05 | Ver Monitor de Existencias por ubicación | El Admin abre la pestaña "Existencias". El sistema carga en paralelo el stock de `LOC-BODEGA` y `LOC-COCINA` y los muestra en dos paneles simultáneos. Cada insumo muestra su stock actual y un badge ÓPTIMO o COMPRAR. | Insumos con stock registrado | Dos tablas paralelas: Bodega (izquierda) y Cocina (derecha) |
| CU-INV-06 | Sincronizar Compras (PULL de mercancía) | El Admin presiona "Sincronizar Compras" desde el panel de Bodega. El sistema lee el JSON de compra base, llama a `sp_sync_purchases` que hace UPSERT de proveedor + insumos + precios + kardex `IN_PURCHASE` + stock en `LOC-BODEGA`. | JSON de compra accesible; ubicación = LOC-BODEGA | Stock de Bodega actualizado; Kardex con registro de entrada |
| CU-INV-07 | Registrar Ajuste Físico (Merma o Sobrante) | El Admin abre la modal de Ajuste desde cualquier insumo en la tabla de Stock. Ingresa el stock físico real encontrado y una nota. `sp_kardex_adjustment` calcula la diferencia y registra en Kardex. | Insumo con stock en BD | Stock actualizado al valor físico; registro ADJUSTMENT en Kardex con nota |
| CU-INV-08 | Intentar ajuste que deje stock negativo | El Admin ingresa una cantidad a restar mayor que el stock teórico actual. El ValidatorEngine JS bloquea antes del HTTP (R-FIN-INV-02). | Stock actual < cantidad a descontar | Sin cambios; modal "Existencia insuficiente" |
| CU-INV-09 | Traspasar Insumo de Bodega a Cocina | El Admin abre la modal de Traspaso desde el panel de Bodega, selecciona Cocina como destino e ingresa la cantidad. `sp_kardex_transfer` descuenta de `LOC-BODEGA`, aplica el `conversion_factor` y suma a `LOC-COCINA`. Ambas tablas se refrescan simultáneamente. | Insumo con stock en LOC-BODEGA | Stock de Bodega disminuido; stock de Cocina aumentado; registro TRANSFER en Kardex |
| CU-INV-10 | Ver Kardex (historial inmutable) | El Admin abre la pestaña "Historial". Ve todos los movimientos: entradas (verde +), salidas (naranja −), ajustes (gris) y traspasos (morado). No hay botones de editar ni eliminar. | Movimientos registrados | Vista de solo lectura del historial contable |
| CU-INV-11 | Generar Sugerencia de Resurtido | El Admin activa el toggle "Ver solo sugerencias de compra". El frontend filtra la tabla de Stock mostrando únicamente los insumos donde `current_stock ≤ minimum_stock`. Para cada uno muestra el proveedor óptimo (menor precio / menor tiempo de entrega) cruzando `supplier_prices`. | Insumos con `minimum_stock` configurado | Lista de compras sugeridas con proveedor recomendado por insumo |
| CU-INV-12 | Ejecutar Cierre de Día — Deducción automática por BOM | Al final del servicio, el sistema procesa los `order_items` en estado `DELIVERED` del día, cruza con `dish_recipes` (BOM) y descuenta del inventario teórico de `LOC-COCINA` la cantidad exacta consumida por cada platillo vendido. | Platillos entregados del día con BOM definido | `inventory_stock_locations` actualizado; registros OUT en Kardex por cada insumo consumido |

---

## MÓDULO 8 — Consumo y Cierre de Turno (Cocina)
**Actor principal:** A-03 (Chef / Jefe de Cocina), A-01 (Admin como observador)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-COC-15 | Ver inventario teórico en tiempo real | Durante el servicio, el sistema descuenta automáticamente del stock teórico cada vez que un platillo es marcado como Listo en KDS (CU-COC-13). El Chef puede consultar el stock actual en cualquier momento. | Servicio activo; platillos marcados como listos | Stock teórico refleja las salidas del día sin intervención manual |
| CU-COC-16 | Realizar Conteo Físico Ciego | Al activar el Cierre de Turno (CU-COC-14), el sistema muestra la lista de insumos **sin mostrar el stock teórico** para no sesgar el conteo. El Chef ingresa físicamente lo que hay en cada refrigerador y estación. | Turno finalizado en Cocina | Stock físico capturado por el Chef |
| CU-COC-17 | Calcular y registrar Merma automáticamente | El sistema compara el stock teórico calculado (entradas − ventas) contra el stock físico capturado por el Chef. La diferencia se registra como `ADJUSTMENT` en el Kardex con nota "Toma Física / Cierre de Turno". | Conteo físico completado | Merma o sobrante registrado en Kardex; stock actualizado al valor físico real |
| CU-COC-18 | Ver Reporte de Fugas en Dashboard Gerencial | El Admin visualiza en su dashboard los registros de merma del día por insumo y cocina, con el costo en pesos de cada diferencia. | Cierre de turno ejecutado con diferencias | Reporte de incidencias visible para el Gerente con valor monetario de pérdidas |
| CU-COC-19 | Generar Lista de Súper (sugerencia de compras post-cierre) | Tras el conteo físico, el sistema revisa qué insumos quedaron por debajo de su stock mínimo y genera la propuesta de compras para el día siguiente. *Este CU comparte algoritmo con CU-INV-11; la diferencia es el actor y el momento de activación.* | Cierre de turno ejecutado; `minimum_stock` configurado | Lista de compras sugeridas disponible para el Jefe de Cocina y para el Gerente |

---

## MÓDULO 9 — POS Meseros
**Actor principal:** A-02 (Mesero / Capitán / Runner)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-MES-01 | Login de Mesero con PIN | El empleado selecciona su nombre del dropdown (solo aparecen los empleados con asignación activa para el turno actual) e ingresa su PIN numérico de 4–6 dígitos. El sistema valida con `fn_get_user_for_pin`. | Empleado con asignación activa y PIN válido | Sesión activa en POS; mapa de mesas visible |
| CU-MES-02 | Login inválido (PIN incorrecto o empleado sin asignación) | El empleado ingresa un PIN incorrecto. El sistema devuelve 401. La pantalla muestra error sin revelar si el número de empleado existe. | PIN no coincide o empleado sin asignación hoy | Sin sesión; modal de error genérico (seguridad ante enumeración) |
| CU-MES-03 | Check-in automático al primer login | Al validar el PIN por primera vez en el día, `sp_record_attendance` inserta el registro con `source = WAITERS`. Este proceso es invisible para el mesero. | Primera autenticación del día | Asistencia registrada; Monitor del Admin muestra "PRESENTE" |
| CU-MES-04 | Ver mapa de mesas de la zona asignada | El mesero ve únicamente las mesas de su zona con colores de estado: verde (AVAILABLE), rojo (OCCUPIED), amarillo (AWAITING_PAYMENT). | Sesión activa; asignación de zona válida | Mapa en tiempo real de las mesas a su cargo |
| CU-MES-05 | Abrir Mesa e indicar comensales | El mesero toca una mesa AVAILABLE, indica el número de comensales y confirma. `sp_pos_open_table` crea la orden en estado OPEN (idempotente: si ya existe una orden OPEN, devuelve la misma). | Mesa en estado AVAILABLE | Mesa cambia a OCCUPIED; orden OPEN creada; QR de sesión generado |
| CU-MES-06 | Registrar Pedido con modificadores | El mesero selecciona platillos por categoría y añade notas opcionales por ítem (términos de carne, alergias, extras). `sp_pos_submit_order` inserta los `order_items` con el estado inicial correspondiente. | Mesa OPEN activa | Ítems registrados con estado PENDING_KITCHEN o PENDING_FLOOR según `has_recipe` |
| CU-MES-07 | División automática de Comanda (Fire) | Al enviar la orden, el sistema enruta automáticamente: los platillos con `has_recipe = true` van al KDS de Cocina (WebSocket); los de `has_recipe = false` (bebidas, pan) aparecen en el POS del mesero para recolección directa. | Orden enviada | Comanda dividida; Cocina recibe sus ítems; mesero ve los suyos para recoger |
| CU-MES-08 | Ver alerta de escasez | Si un producto de `LOC-PISO` tiene stock ≤ 1 unidad por comensal, el POS muestra un aviso visual al mesero antes de confirmar el pedido. | Stock de LOC-PISO bajo | Alerta visible; el mesero puede quitar el ítem antes de enviar |
| CU-MES-09 | Marcar producto de Piso como Recogido | El mesero va al frigorífico o estación de piso, toma el producto y toca "Recogido" en su POS. `sp_pos_collect_item` descuenta la unidad del stock de `LOC-PISO` y registra la salida en Kardex. | Ítem en estado `PENDING_FLOOR` | Ítem = COLLECTED; stock de LOC-PISO disminuido; registro OUT en Kardex |
| CU-MES-10 | Recibir notificación Push de platillo listo | Cuando el Chef marca un platillo como Listo en KDS (CU-COC-13), el servidor envía un evento WebSocket a la tablet del mesero asignado. El botón "Recogido" se habilita para ese ítem. | Ítem en estado `READY` en KDS | Notificación visible en POS; botón "Recogido" habilitado |
| CU-MES-11 | Marcar platillo de Cocina como Recogido | El mesero va a la ventanilla de cocina, toma el platillo y toca "Recogido". `sp_pos_collect_item` descuenta los insumos de `LOC-COCINA` según el BOM del platillo y registra las salidas en Kardex. | Ítem en estado `READY` | Ítem = COLLECTED; stock de cocina disminuido; registros OUT en Kardex por ingrediente |
| CU-MES-12 | Marcar platillo como Entregado | El mesero pone el platillo en la mesa y toca "Entregado". `sp_pos_deliver_item` actualiza `order_items.status = DELIVERED`. | Ítem en estado `COLLECTED` | Ítem = DELIVERED |
| CU-MES-13 | Intentar cobrar con ítems pendientes de entrega | El botón "Solicitar Cuenta / Pre-cerrar Mesa" permanece bloqueado (`disabled`) mientras exista al menos un ítem de la comanda que no tenga estado `DELIVERED`. | Comanda con ítems no entregados | Botón inactivo; ninguna llamada HTTP |
| CU-MES-14 | Pre-cerrar Mesa (generar pre-cuenta) | Todos los ítems están en DELIVERED. El mesero confirma el pre-cierre. `sp_pos_close_table` cambia el estado de la orden a `AWAITING_PAYMENT`. La sesión QR del comensal queda bloqueada. | 100% de ítems en DELIVERED | Orden = AWAITING_PAYMENT; mesa aparece en tablero de Caja; QR bloqueado |
| CU-MES-15 | Cerrar sesión del mesero | El mesero toca el botón de logout. El sistema destruye la sesión en memoria y regresa a la pantalla de login. | Sesión activa | Sesión eliminada; pantalla de login visible |

---

## MÓDULO 10 — Caja y Cobro
**Actor principal:** A-04 (Cajero)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-CAJ-01 | Login de Cajero | El empleado selecciona su nombre del dropdown (solo aparecen los de áreas con `can_access_cashier = true`) e ingresa su PIN. El sistema valida con `fn_get_user_for_pin`. | Empleado con `can_access_cashier = true` y PIN válido | Sesión activa en Caja; tablero de cobro visible |
| CU-CAJ-02 | Login con PIN incorrecto | El cajero ingresa un PIN inválido. Sistema devuelve 401. Modal de error sin revelar datos del empleado. | PIN no coincide | Sin sesión; modal de error genérico |
| CU-CAJ-03 | Ver Tablero de Cobro | El cajero ve exclusivamente las mesas en estado `AWAITING_PAYMENT`, ordenadas por tiempo de espera. Las mesas OPEN no son visibles. | Mesas en AWAITING_PAYMENT existentes | Lista de mesas pendientes de cobro con total y tiempo de espera |
| CU-CAJ-04 | Procesar Pago Simple (un método) | El cajero selecciona una mesa, elige el método de pago (CASH, CARD, TRANSFER u OTHER) e ingresa el monto. `sp_cashier_process_payment` valida que el monto cubra el total, registra el pago, genera el folio TKT y cierra la orden. | Orden en AWAITING_PAYMENT; monto ≥ total | Orden = CLOSED; Ticket con folio TKT-YYYYMMDD-XXXX generado; mesa liberada (AVAILABLE) |
| CU-CAJ-05 | Procesar Pago Dividido (split) | El cajero registra dos o más líneas de pago (ej. $500 CASH + $350 CARD). El SP valida que la suma de `payments[]` cubra el total antes de procesar. | Suma de pagos ≥ total de la orden | Múltiples registros en `payments`; un solo Ticket generado |
| CU-CAJ-06 | Registrar Propina | El cajero ingresa el monto de propina por separado del total de la orden. El SP la registra en la columna `tip` de `payments` para el Corte Z. | Pago procesado correctamente | Propina registrada; separada del subtotal para distribución al personal |
| CU-CAJ-07 | Intentar cobrar con monto insuficiente | El cajero ingresa un monto total menor al total de la orden. El SP lanza excepción "El monto recibido es menor al total". | Suma de payments < total de la orden | Sin cambios; modal de error con diferencia explícita |
| CU-CAJ-08 | Emitir Ticket Final con Folio Único | Como parte del flujo de pago exitoso, el SP obtiene el siguiente valor de `ticket_folio_seq` y genera el folio en formato `TKT-YYYYMMDD-XXXX`. El ticket queda disponible para impresión y para facturación posterior. | Pago procesado correctamente | Ticket registrado en BD; folio verificable con regex `/^TKT-/` |
| CU-CAJ-09 | Liberar Mesa automáticamente tras el pago | Al cerrar la orden, la mesa cambia de `AWAITING_PAYMENT` a `AVAILABLE` automáticamente. El POS del mesero la vuelve a mostrar en verde. | Orden cerrada exitosamente | Mesa disponible para nuevo servicio |
| CU-CAJ-10 | Generar Corte Z (cierre de turno de Caja) | El cajero solicita el Corte Z. El sistema consulta `vw_cashier_corte` y muestra un resumen de: ventas totales del día, ingresos por método de pago y propinas acumuladas. No tiene opciones de edición. | Al menos una transacción del día | Reporte de solo lectura; base para cuadre de caja física |

---

## MÓDULO 11 — Facturación CFDI
**Actor principal:** A-05 (Comensal) en portal auto-servicio, A-07 (API SAT / PAC)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-FAC-01 | Ingresar Folio de Ticket para iniciar facturación | El comensal accede a `invoice.localhost`, ingresa el folio de su ticket (formato `TKT-YYYYMMDD-XXXX`). El sistema valida que el ticket exista y que `is_invoiced = false`. | Ticket existente y no facturado previamente | Formulario de datos fiscales habilitado |
| CU-FAC-02 | Intentar facturar Ticket ya facturado | El comensal ingresa un folio cuyo ticket tiene `is_invoiced = true`. El sistema muestra error informativo. | `tickets.is_invoiced = true` | Sin proceso de timbrado; modal informativo |
| CU-FAC-03 | Intentar facturar con Folio inexistente | El comensal ingresa un folio que no existe en BD. El sistema devuelve error 404. | Folio no registrado en `tickets` | Sin proceso de timbrado; modal "Folio no encontrado" |
| CU-FAC-04 | Capturar datos fiscales del receptor | El comensal ingresa RFC (validado con regex SAT), Código Postal, Régimen Fiscal (selector del catálogo SAT), Uso de CFDI (selector) y correo electrónico. | Ticket válido y no facturado | Datos validados en frontend antes de enviar |
| CU-FAC-05 | Timbrar CFDI 4.0 con el PAC | El sistema calcula el desglose IVA inverso (`precio / 1.16 = subtotal`; `subtotal × 0.16 = IVA`), construye el XML del CFDI 4.0, lo envía al PAC y recibe el XML timbrado con UUID y sello digital. | Datos fiscales válidos; conexión con PAC disponible | CFDI timbrado con UUID único; `sp_mark_ticket_invoiced` actualiza `is_invoiced = true` e inserta `invoice_data` en JSONB |
| CU-FAC-06 | Enviar XML y PDF al correo del cliente | Tras el timbrado exitoso, el sistema genera el PDF legible del CFDI y envía ambos archivos (XML + PDF) al correo capturado vía servidor SMTP. El estado de envío queda registrado en BD. | CFDI timbrado exitosamente | Correo enviado al cliente; estado `ENVIADA` registrado para seguimiento |
| CU-FAC-07 | Reenviar factura por error de correo | Si el envío del correo falló (`ERROR_ENVIO` en BD), el cajero puede solicitar un reenvío desde el panel Admin sin regenerar el CFDI (el UUID ya está timbrado y no cambia). | Factura con estado `ERROR_ENVIO` | Correo reenviado; estado actualizado a `ENVIADA` |

---

## MÓDULO 12 — Menú QR (Comensales)
**Actor principal:** A-05 (Comensal)

| ID | Nombre | Descripción | Precondición | Postcondición |
|---|---|---|---|---|
| CU-QR-01 | Escanear código QR y acceder al menú digital | El comensal escanea el QR físico de la mesa con su celular. El sistema verifica que la sesión de mesa esté activa (`order_headers.status = OPEN`) y muestra el menú. | Mesa con orden en estado OPEN | Menú digital visible en el dispositivo del comensal |
| CU-QR-02 | Navegar menú por categorías (solo lectura) | El comensal navega entre categorías, ve fotos, nombres, descripciones y precios de los platillos activos. No puede hacer pedidos directamente desde este módulo (es thin-client de solo lectura). | Menú con categorías y platillos activos | Información del menú visible; sin opción de agregar al carrito |
| CU-QR-03 | Compartir enlace de sesión de mesa | Un comensal comparte el enlace de la sesión activa (vía WhatsApp u otro medio). Otro comensal abre el mismo enlace y ve la misma sesión sincronizada. | Sesión de mesa activa (OPEN) | Ambos comensales ven el mismo menú; la sesión es compartida sin duplicarse |
| CU-QR-04 | Recargar menú sin perder la sesión | El comensal cierra y vuelve a abrir el enlace o recarga el navegador. El sistema reconecta a la misma sesión activa de la mesa. | Sesión de mesa activa | Menú disponible desde el mismo punto; sin pérdida de contexto |
| CU-QR-05 | Intentar acceder a sesión de mesa ya cerrada | El comensal intenta abrir el enlace tras el pago (orden = CLOSED o CANCELLED). El sistema muestra pantalla de "Sesión Expirada". | Orden en estado CLOSED, CANCELLED o AWAITING_PAYMENT | Pantalla informativa; sin acceso al menú |
| CU-QR-06 | Llamar al mesero desde el menú | El comensal toca el botón flotante "Llamar al mesero". El sistema registra un `waiter_call` en BD con `reason = ASSISTANCE` y estado `PENDING`. El mesero recibe la notificación en su POS. | Sesión de mesa activa | `waiter_calls` registrado; notificación enviada al mesero de la zona |

---

## Resumen de Cobertura Final

| Módulo | CUs totales | Fuente principal |
|---|---|---|
| 1 — Gestión de Piso | 13 | `CU Gestión de Piso.md` + reglas UI piso |
| 2 — Empleados / RRHH | 12 | `admin-empleados.md` + MDM Engine |
| 3 — Turnos y Asistencia | 7 | `08_turnos_asistencia.sql` + `turnos/index.js` |
| 4 — Gestión de Menú (Admin) | 10 | `CU Gestión de Platillos.md` + reglas UI menú |
| 5 — Ingeniería de Menú (Cocina) | 8 | `CU Cocina.md` + `R-UI Ingeniería Menú` |
| 6 — KDS Tiempo Real | 6 | `Micrositio_Cocina.md` + `sp_orders.sql` |
| 7 — Inventario Admin | 12 | `CU Inventario.md` + reglas UI inventario |
| 8 — Consumo / Cierre (Cocina) | 5 | `CU Cocina.md` §Módulo 3 |
| 9 — POS Meseros | 15 | `modulo2_meseros.md` + `sp_orders.sql` + flujos |
| 10 — Caja y Cobro | 10 | `Flujo Caja y Facturación.md` + `sp_cashier.sql` |
| 11 — Facturación CFDI | 7 | `Flujo Caja y Facturación.md` Fase 4 |
| 12 — Menú QR Comensales | 6 | `modulo1_comensales.md` |
| **TOTAL** | **111** | |

> El total pasó de 100 a 111 al desarrollar los módulos faltantes con mayor
> granularidad. Los CUs de error y variantes de flujo que no eran visibles
> en la prosa de los documentos originales emergieron al analizar el código
> de los SPs y el frontend.

---

## Solapamientos Resueltos — Estado Final

| # | Decisión tomada |
|---|---|
| S-01 | CU-COC-04 (Chef construye BOM) y CU-MENU-07 (Gerente revisa comercialmente) **coexisten** como fases del mismo flujo con actores distintos. |
| S-02 | `CU-INV-11` es el CU canónico del algoritmo de sugerencia. Las referencias en Cocina y en CU Gestión de Platillos apuntan a él. |
| S-03 | El Chef da de alta insumos (CU-COC-02/03). El Admin los gestiona a nivel comercial y de proveedores (CU-INV-01 a CU-INV-04). No hay duplicado real. |
| S-04 | `CU-INV-06` es el CU canónico del proceso de compra. |
| S-05 | `CU-INV-07` es el CU canónico del ajuste físico. |

---

## Referencia a Diagramas UML

| Diagrama | Archivo |
|---|---|
| Diagrama de Casos de Uso (Mermaid) | `docs/diagramas/diagramas.md` |
| ERD + SPs + Vistas (Mermaid) | `kore_bar_database_diagram.md` |
| Diagrama de Secuencia — Pedidos | `docs/diagramas/diagramas.md` |
| Diagrama de Secuencia — Aprovisionamiento | `docs/diagramas/diagramas.md` |
| Diagrama de Actividad — Proceso Cocina | `docs/diagramas/diagramas.md` |
| Flujo Operativo POS completo | `docs/Flujo Operativo Definitivo POS, Enrutamiento y KDS.md` |
| Flujo Operativo Caja y Facturación | `docs/Flujo Operativo Caja y Facturación.md` |
