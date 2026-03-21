# 08. Estándar de Base de Datos y Diccionario de Datos

## Filosofía de Diseño
Para garantizar la escalabilidad y migraciones entre ambientes (Dev/QA/Prod), la base de datos de Kore Bar sigue estas reglas estrictas:
1. **Estructura en Inglés:** Nombres de tablas, columnas, funciones y vistas en `snake_case`.
2. **Datos en Español:** Los registros (nombres de puestos, áreas, platillos) en el idioma del negocio.
3. **Llaves Naturales (Idempotencia):** Todo catálogo principal DEBE tener una columna `code` (VARCHAR UNIQUE). Esto permite sincronizar datos o inyectar catálogos sin depender de los UUID autogenerados.
4. **Desacoplamiento (Pivot Tables):** Uso de tablas relacionales para unir catálogos independientes (ej. `positions` une `areas` y `job_titles`, `dish_recipes` une `menu_dishes` e `inventory_items`).
5. Todas las tablas maestras llevan id (UUID) como PK y code (VARCHAR UNIQUE) como Llave Natural. Las relaciones FK se hacen estrictamente con el UUID

---

## Subsistema 1: Recursos Humanos y Autenticación

### Tablas Principales
* `roles`: Niveles de acceso al sistema (Ej: `code`: 'SYS_ADMIN').
* `areas`: Departamentos del restaurante (Ej: `code`: '20').
* `job_titles`: Catálogo de Puestos (Ej: `code`: '04').
* `positions` (Pivot): Une un Área y un Puesto (Ej: `code`: '20-04').
* `employees`: El recurso humano físico. `employee_number` funge como su `code` natural.
* `system_users`: Credenciales de acceso vinculadas al empleado.

---

## Subsistema 2: Gestión de Piso (Restaurant Layout)

### Tablas Principales
* `restaurant_zones`: Áreas físicas del restaurante (Ej: `code`: 'TERR_VIP', name: 'Terraza VIP').
* `restaurant_tables`: Mesas asignables a zonas (Ej: `code`: 'T-01', capacity: 4).
* `restaurant_assignments`: Matriz transaccional. Asigna meseros a zonas por turnos. Tiene restricciones UNIQUE compuestas para evitar empalmes y sobrecupos.

---

## Subsistema 3: Inventario y Proveedores (Aprovisionamiento)

### Tablas Principales
* `suppliers`: Proveedores del restaurante.
  * `code` (VARCHAR UNIQUE): Ej. 'PROV-COCA', 'PROV-CARNE'.
  * `name`, `contact_info` (VARCHAR).
* `inventory_items`: Insumos (materia prima) y productos de venta directa.
  * `code` (VARCHAR UNIQUE): Ej. 'INS-TOMATE', 'PROD-COCA-LATA'.
  * `unit_measure` (VARCHAR): Kg, Lts, Pz.
  * `current_stock`, `minimum_stock` (DECIMAL).
* `supplier_prices` (Pivot): Relaciona quién nos vende qué cosa, a qué precio y en cuánto tiempo.
  * `supplier_id` (UUID) + `item_id` (UUID).
  * `price` (DECIMAL): Costo de compra.
  * `lead_time_days` (INT): Tiempo promedio de entrega para el algoritmo.

---

## Subsistema 4: Ingeniería de Menú (Punto de Venta)

### Tablas Principales
* `menu_categories`: Clasificación para la App y Comanda.
  * `code` (VARCHAR UNIQUE): Ej. 'CAT-BEB', 'CAT-ENT'.
  * `name` (VARCHAR): Ej. 'Bebidas', 'Entradas'.
* `menu_dishes`: El producto comercial que se cobra al cliente.
  * `code` (VARCHAR UNIQUE): Ej. 'PL-TACO-PAST'.
  * `name`, `description`, `image_url` (VARCHAR).
  * `price` (DECIMAL): Precio de venta al público.
* `dish_recipes` (BOM - Bill of Materials): La "Receta Base". Define qué insumos se restan del inventario al vender un platillo.
  * `dish_id` (UUID) + `item_id` (UUID).
  * `quantity_required` (DECIMAL): Cuánto consume (Ej. 0.150 Kg de carne).