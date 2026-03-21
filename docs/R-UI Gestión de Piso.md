### 🪑 1. Reglas de Interfaz y Filtros (UX/UI)

* **R-UI-01: Selector Maestro Único (Mesas):** Se elimina la dualidad. Existirá un único `<select>` global para las Zonas.
* *Efecto:* Al cambiarlo, filtra la lista de mesas abajo Y sirve como objetivo para el input de "Crear Mesa". Si el selector está en "Selecciona una zona...", el botón de agregar mesa debe estar bloqueado o lanzar advertencia.


* **R-UI-02: Cascada de Puestos (Asignaciones):** Se agrega un nuevo `<select>` de "Puestos" (Ej. Capitán, Mesero, Runner).
* *Efecto:* El `<select>` de Empleados arranca deshabilitado. Solo al elegir un puesto, se llena con los empleados activos que pertenezcan *exclusivamente* a ese ID de Puesto. El puesto seleccionado debe recordarse (quedar fijo) para la "ráfaga de captura".


* **R-UI-03: Cálculo Visual de Vigencia:** La columna "Vigencia" en la tabla inferior ya no dirá un texto estático ("Solo hoy", "Semana").
* *Efecto:* El sistema calculará la fecha dinámicamente y pintará el rango real. Ejemplos: `08/Mar/2026`, `08/Mar - 14/Mar`, `08/Mar - 07/Abr`.



### ⏱️ 2. Reglas de Tiempo y Calendario

* **R-TIME-01: Prevención de Viaje en el Tiempo (Bloqueo de Pasado):** * *Efecto:* El motor comparará la fecha seleccionada en el `<input type="date">` contra la fecha actual del navegador (Día 0). Queda estrictamente prohibido guardar cualquier asignación con fecha de ayer o anterior.
* **R-TIME-02: Proyección de Recurrencia:** * *Efecto:* Si el usuario elige "Semana" o "Mes", el motor de reglas no solo valida el día de inicio. Debe generar un arreglo virtual (Día 1, Día 2... Día 7) y pasar **todos los días** por el filtro de colisiones antes de autorizar el guardado.

### 💥 3. Reglas Críticas Anti-Colisión (El Gatekeeper)

Esta es la matriz matemática que protegerá a la base de datos de empalmes o sobrecupos. Se evaluarán 4 variables: Empleado (`E`), Zona (`Z`), Turno (`T`) y Fecha (`F`).

* **R-COL-01: Omnipresencia del Empleado (Clonación):**
* *Regla:* Un Empleado (`E`) no puede estar en dos Zonas distintas (`Z1`, `Z2`) en el mismo Turno (`T`) y en la misma Fecha (`F`).
* *Falla si:* Intento asignar a "Juan" en Terraza Matutino el lunes, y luego intento asignar a "Juan" en Salón Matutino el mismo lunes.


* **R-COL-02: Sobrecupo de Zona (La regla que detectaste):**
* *Regla:* Una Zona (`Z`) solo puede tener a UN Empleado asignado (`E`) por Turno (`T`) en una Fecha (`F`).
* *Falla si:* "Terraza VIP" ya tiene a "Juan" en Vespertino el martes, e intento asignarle a "Pedro" la "Terraza VIP" en Vespertino el mismo martes.


* **R-COL-03: Protección de Bloque (Todo o Nada en Recurrencia):**
* *Regla:* Si se asigna a "Juan" por una "Semana" a la Terraza, el motor revisará los 7 días. Si resulta que el jueves la Terraza ya estaba asignada a "María", la asignación de TODA la semana de Juan es rechazada para evitar agendas "agujereadas" o parciales.


* *(Opcional)* **R-COL-04: Prevención de Doble Turno (Fatiga):**
* *Pregunta para ti:* Actualmente, si "Juan" trabaja en Terraza el Lunes en turno MATUTINO... ¿El sistema le debe permitir trabajar ese mismo Lunes en turno VESPERTINO (doble turno), o debemos bloquear que un empleado trabaje dos turnos el mismo día?

