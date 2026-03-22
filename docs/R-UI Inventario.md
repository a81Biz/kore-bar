# Reglas de Interfaz y Filtros - Gestión de Inventario

Este documento define el comportamiento estricto del frontend y la experiencia de usuario (UX) para el módulo de Inventarios y Proveedores.

### 🪑 1. Reglas de Interfaz y Flujo Visual (UX/UI)

* **R-UI-INV-01: Navegación por Pestañas (Tabs):**
* *Regla:* La vista se divide en 3 paneles: Proveedores, Stock y Kardex.
* *Efecto:* Al hacer clic en una pestaña, el sistema debe ocultar/mostrar los contenedores (`#view-...`) sin recargar la página, actualizando el color de la pestaña activa para indicar el contexto.


* **R-UI-INV-02: Auto-Refresh Post-Transacción:**
* *Regla:* Tras el alta exitosa de un proveedor o una entrada de inventario.
* *Efecto:* La tabla correspondiente se vuelve a renderizar inmediatamente con los datos frescos del backend. El formulario se limpia utilizando el `formEngine`.


* **R-UI-INV-03: Parseo Visual de Transacciones (Badges):**
* *Regla:* Los códigos de base de datos (`IN`, `OUT`, `ADJ`) no deben mostrarse crudos al usuario.
* *Efecto:* El renderizado debe inyectar insignias coloridas: `ENTRADA` (Verde con un `+` en la cantidad), `SALIDA/MERMA` (Naranja con un `-` en la cantidad), `AJUSTE` (Gris).



---

### 📝 2. Reglas de Formato e Integridad Matemática

* **R-FORMAT-INV-01: Estandarización de Códigos de Proveedor:**
* *Regla:* Los códigos no pueden contener espacios ni caracteres especiales.
* *Falla si:* Se intenta guardar "PROV CARNES".
* *Efecto:* El Motor de Validación bloquea el envío. Solo se permiten letras mayúsculas, números y guiones (Ej. `PROV-CARNES`).


* **R-FIN-INV-01: Regla de Costo Cero (Entradas):**
* *Regla:* Toda mercancía que ingresa por compra debe tener un valor monetario para el cálculo de costeos de recetas.
* *Falla si:* Se intenta registrar una entrada (`IN`) con costo `$0.00` o negativo.
* *Efecto:* El sistema bloquea la transacción.


* **R-FIN-INV-02: Bloqueo de Stock Negativo (Ajustes):**
* *Regla:* Un ajuste de salida (`OUT` o `ADJ`) no puede exceder la cantidad físicamente disponible en el sistema.
* *Falla si:* Se intenta dar de baja 10 Kg de tomate cuando el `current_stock` es de 5 Kg.
* *Efecto:* El Gatekeeper bloquea la transacción indicando "Existencia insuficiente".



---

### 💥 3. Reglas Críticas Relacionales (Gatekeeper)

* **R-COL-INV-01: Anti-Colisión de Proveedores (Local):**
* *Regla:* Prevención de duplicados antes de tocar la red.
* *Efecto:* Si el código de proveedor ingresado ya existe en el array local en memoria, se bloquea el POST y se lanza una Modal de Error.


* **R-REL-INV-01: Inmutabilidad Visual del Kardex:**
* *Regla:* La tabla del historial de movimientos es un registro contable auditable.
* *Efecto:* Está estrictamente prohibido incluir botones de "Editar" o "Eliminar" en la vista del Kardex. Si se cometió un error en una entrada, debe compensarse con un registro de "Ajuste".

* **R-UI-INV-04: Filtro de Alerta de Stock:**
* *Regla:* En la tabla de Stock, agregaremos un *switch* o botón que diga "Ver solo sugerencias de compra".
* *Efecto:* Al activarlo, el frontend filtra la tabla para mostrar únicamente los insumos en números rojos y le añade una columna dinámica que dice "Comprar a: [Nombre del Proveedor]".

* **R-UI-INV-05: Vista Split Bodega / Cocina (Tabla Dual):**
  * *Regla:* La pestaña "Existencias" muestra SIEMPRE dos paneles
    simultáneos: `LOC-BODEGA` a la izquierda y `LOC-COCINA` a la derecha.
    Nunca son la misma tabla con un filtro.
  * *Efecto:* El gerente ve el estado completo de ambas ubicaciones 
    sin hacer ningún clic adicional.

* **R-UI-INV-06: Origen de Traspasos siempre es LOC-BODEGA:**
  * *Regla:* El botón "Traspasar" solo existe en el panel de Bodega.
    El payload siempre envía `sourceLocation: 'LOC-BODEGA'`.
  * *Efecto:* Al confirmar un traspaso, AMBAS tablas se refrescan 
    simultáneamente (Bodega baja, Cocina sube).

* **R-UI-INV-07: Ajuste físico disponible en ambas ubicaciones:**
  * *Regla:* El botón "Ajustar" existe en los dos paneles.
    El payload incluye `locationCode` que toma el valor del panel 
    desde donde se abre la modal (`LOC-BODEGA` o `LOC-COCINA`).
  * *Efecto:* Se puede registrar merma en cocina sin tocar el stock de bodega.

* **R-FIN-INV-04: Actualización de Inventario Físico (El Ajuste Rápido):**
* *Regla:* Para hacer los "Ajustes de Merma" o registrar cuando Compras entregue la mercancía, en la misma fila del insumo habrá un botón de `+/- Ajustar`.
* *Efecto:* Abre una modal minúscula: *"¿Sumar o Restar? ¿Cuánto? ¿Motivo?"*. Esto dispara el endpoint que ajusta el `current_stock` y escribe en el `inventory_kardex`.
