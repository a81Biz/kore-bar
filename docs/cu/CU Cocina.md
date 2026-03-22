# Casos de Uso: Micrositio de Cocina (`kitchen.localhost`)

## 👨‍🍳 Módulo 1: Ingeniería de Menú y Recetas (Backoffice del Chef)

*Este módulo es donde el Chef atiende las peticiones del Gerente y diseña cómo se preparará cada platillo.*

* **CU-COC-01: Bandeja de Platillos Pendientes.** * *Descripción:* El sistema muestra al Chef una lista de los platillos que el Gerente dio de alta en el Admin (Ej. "Pasta Alfredo") pero que aún no tienen una receta asignada o están marcados como "En Desarrollo".
* **CU-COC-02: Gestión del Catálogo de Insumos (Ingredientes Básicos).**
* *Descripción:* El Chef puede buscar si un ingrediente ya existe. Si no existe (Ej. "Jamón Serrano"), lo da de alta especificando **únicamente** su nombre y su Unidad de Medida (Kilos, Litros, Piezas, Gramos).
* *Restricción de Negocio:* El Chef **NO** ingresa precios ni proveedores. Eso es tarea de la Administración en la Fase 3.


* **CU-COC-03: Construcción de la Receta Base (El BOM - Bill of Materials).**
* *Descripción:* El Chef selecciona un platillo de la bandeja (Ej. "Pasta Alfredo") y le va agregando los insumos requeridos, indicando la cantidad exacta matemática. (Ej. 0.150 Kg de Pasta, 0.050 Kg de Jamón Serrano, 1 Pz de Perejil).


* **CU-COC-04: Carga de Evidencia Visual (Emplatado).**
* *Descripción:* Una vez terminada la receta, el Chef sube una fotografía del platillo terminado para estandarizar el emplatado. Esta foto viajará de regreso al Admin para la aprobación del Gerente y será la que vean los clientes/meseros.


* **CU-COC-05: Envío a Revisión (Hand-off a Gerencia).**
* *Descripción:* El Chef marca la receta como "Completada". El platillo desaparece de su bandeja de pendientes y el sistema notifica al Admin que ya puede costear los ingredientes y activar el platillo para la venta.



## 🍳 Módulo 2: Operación en Tiempo Real (Pizarra de Cocina / KDS)

*Esta es la pantalla táctil o monitor que ven los cocineros durante el servicio activo.*

* **CU-COC-06: Recepción de Comandas (Tickets Virtuales).**
* *Descripción:* La pantalla muestra en tiempo real los platillos que los meseros van pidiendo desde sus tabletas. Se ordenan cronológicamente (los más antiguos primero) e indican la Mesa y notas especiales (Ej. "Sin cebolla").


* **CU-COC-07: Marcado de Platillos Listos (Despacho).**
* *Descripción:* Cuando el cocinero termina un platillo, lo toca en la pantalla para marcarlo como "Listo". Esto desaparece el platillo de la pizarra y dispara una notificación automática a la tableta del mesero para que vaya a recogerlo.



## 📦 Módulo 3: Control de Inventario Físico y Aprovisionamiento
*Tareas de control de almacén lideradas por el Jefe de Cocina, apoyadas por el descontador automático del sistema.*

* **CU-COC-08: Descontador Automático (Inventario Teórico).**
  * *Descripción:* El sistema lleva un registro en tiempo real. Por cada platillo marcado como "Listo" en la pizarra (CU-COC-07), el sistema busca su Receta Base y descuenta automáticamente los gramajes del inventario. 
  * *Ejemplo:* Si en la mañana había 1,000g de Jamón y se vendieron 5 pastas (50g c/u), el sistema sabe que el "Stock Teórico" debe ser 750g.

* **CU-COC-09: Cierre de Turno (Conteo Físico y Merma).**
  * *Descripción:* Al final del día, el Chef entra a la pantalla de Cierre. El sistema le muestra la lista de ingredientes pero le *oculta* el número teórico para no sesgarlo. El Chef cuenta físicamente y captura lo que hay en sus refrigeradores (Ej. "Hay 740g de Jamón").
  * *Efecto:* El sistema cruza el valor Teórico (750g) contra el Físico (740g) y calcula automáticamente una **Merma de 10g**.

* **CU-COC-10: Reporte de Fugas (Hacia Gerencia).**
  * *Descripción:* Toda merma detectada en el CU-COC-09 se registra en una tabla de incidencias que viajará directamente al **Dashboard del Administrador**. Así, el gerente sabe exactamente cuánto dinero se está perdiendo en mermas o posibles robos.
  
* **CU-COC-11: Generación de Sugerencia de Pedido (Lista del Súper).**
  * *Descripción:* Basado en el *Inventario Físico* final, el sistema revisa qué ingredientes cayeron por debajo de su stock mínimo de seguridad y le genera al Chef la propuesta de compras para el día siguiente.

