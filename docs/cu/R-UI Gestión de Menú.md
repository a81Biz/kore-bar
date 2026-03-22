# Reglas de Interfaz y Filtros - Gestión de Menú (W10)

Este documento define el comportamiento estricto del frontend, las validaciones previas a la base de datos y la experiencia de usuario (UX) para el Catálogo Comercial (Categorías y Platillos).

### 🪑 1. Reglas de Interfaz y Filtros (UX/UI)

* **R-UI-MENU-01: Auto-Refresh Cruzado (Sincronía de Columnas):**
  * *Regla:* Las columnas de "Categorías" y "Platillos" operan de manera independiente pero están suscritas al mismo canal de eventos (`PubSub`).
  * *Efecto:* Al guardar una Categoría nueva con éxito, el sistema recarga silenciosamente la lista de categorías y actualiza inmediatamente los selectores `<select>` de la columna de Platillos sin requerir recargar la página (F5).

* **R-UI-MENU-02: Ráfaga de Captura (Optimización Data-Entry):**
  * *Regla:* El formulario de alta de Platillos está diseñado para capturas masivas continuas.
  * *Efecto:* Al guardar un Platillo exitosamente, el formulario limpia el código, nombre, descripción y precio, **pero conserva intacta la Categoría seleccionada** en el `<select>` y devuelve el foco (`focus()`) al input del Código.

* **R-UI-MENU-03: Selector Maestro y Filtro en Memoria (Cuadrícula):**
  * *Regla:* El `<select>` superior derecho actúa como un filtro maestro para la cuadrícula de tarjetas de platillos.
  * *Efecto:* Al cambiar la categoría en el filtro, la vista se actualiza instantáneamente en **0ms** evaluando el arreglo (array) de platillos que ya existe en la memoria caché del navegador. Queda estrictamente prohibido lanzar peticiones HTTP (`fetch`) a la base de datos para ejecutar este filtro visual.

---

### 📝 2. Reglas de Formato e Integridad de Datos

* **R-FORMAT-01: Estandarización Estricta de Códigos (Llaves Naturales):**
  * *Regla:* Los campos `cat-code` y `plat-code` son llaves vitales que posteriormente se cruzarán con el inventario (BOM).
  * *Falla si:* El usuario intenta ingresar espacios en blanco, caracteres especiales o minúsculas (Ej. "PL 01" o "pl@01").
  * *Efecto:* El Motor de Reglas JS rechaza la captura con un error modal. Solo se permiten letras mayúsculas, números y guiones (Regex: `/^[A-Z0-9\-]+$/`). Ejemplos válidos: `BEB-01`, `PL-TACO-PAST`.

* **R-FIN-01: Integridad Financiera de Platillos:**
  * *Regla:* El sistema no puede permitir la creación de productos que generen pérdidas matemáticas o errores en la facturación.
  * *Falla si:* Se intenta capturar un platillo con un precio negativo o con texto en lugar de números.
  * *Efecto:* El Motor de Reglas detiene el envío y exige un número real positivo (precio $\ge$ 0).

---

### 💥 3. Reglas Críticas Anti-Colisión y Relacionales (El Gatekeeper)

* **R-COL-MENU-01: Prevención de Duplicidad en Memoria (Anti-Colisión Local):**
  * *Regla:* Antes de molestar a la Base de Datos con una petición HTTP, el frontend debe revisar sus propios datos cacheados.
  * *Falla si:* Se intenta crear una Categoría o Platillo usando un Código (`code`) que ya existe visualmente en las listas de la pantalla actual.
  * *Efecto:* Bloqueo inmediato del formulario mostrando el mensaje: *"El código ya existe"*.

* **R-REL-MENU-01: Protección de Integridad Relacional (Smart Delete):**
  * *Regla:* Las Categorías y los Platillos tienen una relación fuerte (Restricción de Integridad Referencial).
  * *Falla si:* El Gerente hace clic en el botón de eliminar ("Bote de basura") de una Categoría que actualmente tiene platillos activos asociados.
  * *Efecto:* La base de datos captura la violación y devuelve un error `P0001`. El orquestador de UI intercepta este código y muestra una modal preventiva indicando que debe reasignar o borrar los platillos primero.