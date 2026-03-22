### 📦 Bloque 1: Catálogo de Insumos e Inventario Base

Antes de cocinar o comprar, el sistema debe saber qué "materias primas" y "productos directos" existen en el restaurante.

* **CU-INS-01: Alta de Insumos/Ingredientes:** Registrar productos básicos (Ej. Carne de ternera, Sardinas, Tomate) especificando su unidad de medida (Kilos, Litros, Gramos, Piezas).
* **CU-INS-02: Alta de Productos de Venta Directa:** Registrar productos que no requieren preparación (Ej. Refrescos embotellados, Agua, Pan).
* **CU-INS-03: Ajuste de Inventario Manual:** Permite al Jefe de Cocina registrar mermas (comida echada a perder) o hacer el conteo del inventario inicial físico.

### 🚚 Bloque 2: Gestión de Proveedores y Compras (Aprovisionamiento)

Este bloque controla quién nos vende, a qué precio, en cuánto tiempo y registra el gasto.

* **CU-PROV-01: Gestión de Proveedores:** Dar de alta proveedores con sus datos de contacto.
* **CU-PROV-02: Catálogo de Precios por Proveedor:** Relacionar un Insumo con un Proveedor, definiendo el "Precio de Compra" y el "Tiempo promedio de entrega". *(Un mismo insumo, como el tomate, puede tener 2 proveedores con distinto precio).*
* **CU-COMP-01: Algoritmo de Sugerencia de Pedido:** El sistema calcula qué falta y sugiere al proveedor óptimo cruzando el mejor precio y el menor tiempo de entrega.
* **CU-COMP-02: Generación y Recepción de Órdenes de Compra:** El Jefe de Cocina autoriza el pedido. Al recibir la mercancía, el sistema suma las cantidades al Inventario y guarda el total de la factura para el reporte de gastos.

### 🍔 Bloque 3: Ingeniería de Menú (El Core)

Aquí es donde el Gerente une los ingredientes para crear lo que el cliente final verá y comprará.

* **CU-MENU-01: Gestión de Categorías:** Crear clasificaciones para ordenar el menú (Ej. Entradas, Platos Fuertes, Bebidas).
* **CU-MENU-02: Alta de Platillos (Catálogo Comercial):** Registrar el nombre del platillo, descripción, fotografía, categoría, precio de venta al público y su estado (Activo/Agotado).
* **CU-MENU-03: Construcción de la Receta Base (BOM):** Relacionar un "Platillo" con múltiples "Insumos" indicando la cantidad exacta que consume cada uno. *(Ej. Platillo "Limonada" = 1 pieza de Insumo "Refresco", 0.05 L de Insumo "Jugo de Limón").*

### 📉 Bloque 4: Motor de Consumo Diario

La magia que conecta las ventas de los meseros con las compras del Jefe de Cocina.

* **CU-CONS-01: Deducción Automática (Cierre de Día):** Al final del día, el Jefe de Cocina ejecuta un proceso. El sistema lee todos los platillos vendidos, busca su "Receta Base" y resta matemáticamente los insumos exactos del inventario global.
* **CU-CONS-02: Alerta de Stock Crítico:** Si tras la deducción un insumo cae por debajo del nivel mínimo, se marca en rojo para el próximo aprovisionamiento.

---