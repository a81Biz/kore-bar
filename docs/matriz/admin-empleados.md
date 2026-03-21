# Matriz de Reglas de Negocio y Casos de Uso
**Módulo:** Administración - Gestión de Empleados y Sincronización HR
**Fecha de Definición:** Marzo 2026

## Descripción del Flujo
El sistema actúa como una capa intermedia entre los datos puros de Recursos Humanos (JSON/API) y la Base de Datos Operativa (PostgreSQL). La sincronización ocurre primero en memoria (Drafting) para proteger la integridad de los datos locales antes de su persistencia.

---

## FASE 1: Procesamiento del Catálogo de Puestos
**Regla Estructural:** Un empleado no puede ser asignado a un puesto que no exista en el catálogo del sistema.

| ID | Escenario (Input desde JSON HR) | Comportamiento del Motor de Validaciones / Backend |
| :--- | :--- | :--- |
| **CAT-01** | **Puesto Nuevo:** El JSON trae un puesto/área que no existe en la BD local. | Se inserta en la tabla `puestos`. Queda inmediatamente disponible en los selectores de la UI. |
| **CAT-02** | **Puesto Existente:** El JSON trae un puesto que ya existe en la BD. | Se actualiza su `fecha_actualizacion` en BD. IDs y relaciones previas con empleados se mantienen intactas. |
| **CAT-03** | **Baja Lógica de Puesto:** Un puesto existe en BD pero ya NO viene en el JSON de HR. | **CRÍTICO:** NO se elimina de la BD (rompería el historial de empleados antiguos). Se marca con `is_active = false`. Deja de aparecer en la UI para nuevas asignaciones. |
| **CAT-04** | **Área Desconocida:** El JSON trae un código de área que no está mapeado en la lógica del sistema (ej. "MANTENIMIENTO" en lugar de "PISO"). | Se acepta el catálogo, pero en la UI se agrupa bajo una categoría genérica ("OTRAS ÁREAS") hasta que el Frontend se actualice para soportarla. |

---

## FASE 2: Sincronización de Empleados (JSON a Memoria/UI)
**Regla Estructural:** La lectura del JSON *fusiona* los datos en la tabla visual, pero no muta la Base de Datos hasta que el usuario confirme los cambios manualmente.

| ID | Escenario (Input desde JSON HR) | Comportamiento de la UI y Reglas de Memoria |
| :--- | :--- | :--- |
| **EMP-01** | **Alta Pura:** Empleado nuevo (`action="alta"`), no existe en la BD. | Se pinta en la tabla con la etiqueta "Borrador" (`isDraft`). Obliga al usuario a editarlo y asignarle un Área/Puesto antes de poder guardarlo en BD. |
| **EMP-02** | **Registro Existente Idéntico:** Empleado con `action="alta"` que ya existe en BD con la **misma `fecha_llegada`**. | El Motor lo **IGNORA** silenciosamente de la actualización. Se protege el registro local para no sobreescribir mapeos de áreas que el usuario ya haya hecho. |
| **EMP-03** | **Reingreso Válido:** Empleado existe en BD, el JSON trae `action="reingreso"` y una `fecha_llegada` más reciente. | Se pinta en la tabla, se auto-marca como "Activo". Actualiza su fecha de alta en memoria y se marca como "Borrador" esperando la confirmación de su nueva área/puesto. |
| **EMP-04** | **Reingreso Inválido (Colisión temporal):** El JSON dice "reingreso" pero la fecha de llegada es más antigua que la registrada en BD. | El Motor rechaza el registro específico y loguea un error de inconsistencia temporal. Prevalece el dato de la BD. |
| **EMP-05** | **Duplicidad en el mismo lote (Batch Collision):** El JSON trae dos empleados distintos con el mismo ID (ej. 80219620). | El Motor detecta la colisión en memoria. **Rechaza el segundo registro** y lanza una alerta de "Datos de origen corruptos (ID duplicado)". |
| **EMP-06** | **Datos Vitales Faltantes:** El registro no trae Nombre o Número de Empleado. | Falla la validación de esquema del Motor. Se ignora la fila y se agrega al log de errores sin detener el resto del lote. |

---

## FASE 3: Edición y Persistencia (De la UI a la BD)
**Regla Estructural:** Los endpoints de la API confían en el validador del frontend, pero el Backend (Hono) debe aplicar sus propias validaciones estrictas de esquema antes del insert.

| ID | Escenario (Interacción del Usuario en Modal) | Comportamiento Esperado (Endpoint / UI) |
| :--- | :--- | :--- |
| **UI-01** | **Guardar Borrador (Primer Guardado):** Usuario edita un empleado del JSON (`isDraft=true`), asigna Área y Puesto, y presiona Guardar. | Validación UI aprueba. Se llama a `POST /api/admin/employees`. En éxito, el estado `isDraft` pasa a falso y el modal se cierra. |
| **UI-02** | **Actualizar Empleado Histórico:** Usuario edita un empleado que ya existía en la BD (`isDraft=false`). | Validación UI aprueba. Se llama a `PUT /api/admin/employees/:id`. |
| **UI-03** | **Cambio de Área Dinámico:** Usuario cambia de Área (ej. de "PISO" a "COCINA") en el modal. | El selector de "Puesto" se limpia instantáneamente y se repuebla **solo** con los puestos del área "COCINA". |
| **UI-04** | **Baja Lógica de Empleado:** Usuario apaga el Switch "Empleado Activo" y guarda. | Se llama a `PUT` con `is_active: false`. El sistema NO elimina la fila (para no romper auditorías de ventas pasadas), solo actualiza el badge a "Inactivo" en la UI. |
| **UI-05** | **Intento de Guardado Incompleto:** Usuario intenta guardar un Borrador sin asignarle Puesto o Área. | El Motor de Validación detiene el envío. Se muestran los campos faltantes en rojo (FormEngine). No se llama a ninguna API. |