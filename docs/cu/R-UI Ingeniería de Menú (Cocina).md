# Reglas de Interfaz y Filtros - Ingeniería de Menú (Cocina)

Este documento define el comportamiento estricto del frontend y la experiencia de usuario (UX) para el Laboratorio de Recetas en el Micrositio de Cocina, donde el Chef diseña el BOM (Bill of Materials) de los platillos pendientes.

### 🪑 1. Reglas de Interfaz y Flujo Visual (UX/UI)

* **R-UI-REC-01: Bloqueo de Contexto (Estado Cero):**
  * *Regla:* Al cargar la pantalla, la Columna 2 (Laboratorio) arranca completamente deshabilitada (inputs bloqueados, botones opacos).
  * *Efecto:* Solo se habilita cuando el Chef hace clic en un platillo de la Bandeja de Pendientes (Columna 1). Si se marca un platillo como terminado, el Laboratorio vuelve a su Estado Cero.

* **R-UI-REC-02: Formulario Híbrido (Buscador vs. Creador):**
  * *Regla:* El input de "Código de Insumo" (`#ing-code`) actúa como buscador y creador a la vez, evaluando la caché de ingredientes (`GET /kitchen/ingredients`).
  * *Efecto:* Al perder el foco (`blur`) del input de Código:
    * **Si el código EXISTE en caché:** El sistema autocompleta el Nombre y Unidad, **bloquea** esos dos inputs (para evitar ediciones accidentales del catálogo) y salta el foco directo a "Cantidad".
    * **Si el código NO EXISTE:** Mantiene el Nombre y Unidad habilitados para que el Chef registre el nuevo insumo.

* **R-UI-REC-03: Ráfaga de Receta (Data-Entry Continuo):**
  * *Regla:* El formulario de insumos está optimizado para capturar listas largas rápidamente.
  * *Efecto:* Al hacer clic en "Añadir", el insumo baja a la tabla de la receta e inmediatamente el formulario se limpia y devuelve el foco (`focus()`) al input de Código, listo para el siguiente ingrediente.

---

### 📝 2. Reglas de Formato e Integridad Matemática

* **R-FORMAT-REC-01: Estandarización de Códigos de Insumo:**
  * *Regla:* Igual que en el Menú de Gerencia, los códigos de la cocina no pueden tener espacios.
  * *Falla si:* El Chef intenta crear "TOM SALADET" (con espacio).
  * *Efecto:* El Motor de Reglas JS rechaza el envío. Solo letras mayúsculas, números y guiones. (Ej. `ING-TOM-SAL`).

* **R-FIN-REC-01: Control de Unidad Métrica:**
  * *Regla:* La cantidad del insumo en la receta DEBE ser estrictamente mayor a `0` y permitir hasta 3 decimales para medidas precisas (Ej. 0.150 Kilos).
  * *Falla si:* El Chef intenta poner `0`, valores negativos o texto en el campo de cantidad.
  * *Efecto:* El Motor de Reglas bloquea la inserción en la tabla.

---

### 💥 3. Reglas Críticas Relacionales y Handoff (El Gatekeeper)

* **R-COL-REC-01: Upsert Visual (Colisión de Insumos):**
  * *Regla:* Si el Chef intenta agregar un ingrediente que ya está en la tabla de la receta actual (Ej. vuelve a agregar "Cebolla").
  * *Efecto:* En lugar de lanzar un error, el frontend busca la fila existente de "Cebolla" en la tabla visual y **sobrescribe** la cantidad con el nuevo valor. Esto imita el comportamiento de `ON CONFLICT DO UPDATE` que configuramos en PostgreSQL.

* **R-REL-REC-01: Handoff Condicionado (Botón de Terminar):**
  * *Regla:* El botón verde "Marcar Platillo como Terminado" representa el *Handoff* (devolver el platillo a Gerencia).
  * *Falla si:* El Chef hace clic en terminar pero la tabla de ingredientes de la receta está vacía (0 filas).
  * *Efecto:* El botón debe permanecer bloqueado (`disabled`) hasta que la receta tenga al menos 1 insumo agregado.

* **R-REL-REC-02: Flujo de Cierre de Receta:**
  * *Regla:* Al marcar un platillo como terminado con éxito.
  * *Efecto:* El sistema: 
    1) Desaparece el platillo de la lista de Pendientes (Columna 1).
    2) Vacía la tabla de ingredientes.
    3) Aplica el bloqueo `R-UI-REC-01` (Estado Cero).
    4) Muestra una notificación de éxito: *"Receta enviada a Administración"*.