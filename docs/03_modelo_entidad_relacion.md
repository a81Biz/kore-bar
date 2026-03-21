# Justificación del Modelo Entidad-Relación (MER)

## 1. Introducción
El diseño de la base de datos es el núcleo de persistencia que conecta a los cinco micro-frontends de la plataforma. Se ha implementado un esquema relacional altamente normalizado (hasta la Tercera Forma Normal - 3FN) para evitar redundancias, garantizar la integridad referencial y soportar la carga transaccional de un entorno de hospitalidad de alto volumen.

## 2. Diseño de Módulos y Entidades Críticas
El modelo se dividió lógicamente para resolver problemas específicos del negocio:

* **Módulo de Autenticación y RRHH Unificado:**
  * *Decisión:* Las entidades `Empleados` y `Usuarios_Sistema` se separaron de los roles operativos (Mesero, Cocinero). 
  * *Justificación:* Centraliza el control de acceso y permite la gestión de inasistencias en una sola tabla, simplificando la lógica de autorización (JWT / PIN) para acceder a cada `.sitio`.

* **Tabla Pivote de Eficiencia (`Asignacion_Diaria`):**
  * *Decisión:* Creación de una entidad temporal que relaciona `Mesero`, `Mesa`, `Zona` y `Turno`.
  * *Justificación:* Brinda soporte a la inteligencia de negocios (BI). Permite al administrador extraer métricas granulares complejas, tales como "qué mesero genera mayor ticket promedio en la zona de terraza durante el turno vespertino".

* **Separación de Catálogo y Recetario (`Recetas`):**
  * *Decisión:* Implementación de una relación N:M entre `Platillos` e `Insumos` a través de la tabla `Recetas`.
  * *Justificación:* Desacopla la venta del inventario. Permite ejecutar el algoritmo de explosión de insumos o proceso *batch* nocturno: por cada `Platillo` vendido en `Detalle_Orden`, el sistema consulta la tabla `Recetas` y deduce fracciones exactas (ej. gramos, mililitros) del `Stock_Actual` en la tabla `Insumos`.

* **Gestión de Aprovisionamiento Inteligente (`Catalogo_Proveedores`):**
  * *Decisión:* Relación múltiple entre `Proveedores` e `Insumos`.
  * *Justificación:* Un mismo insumo (ej. Carne de Res) puede ser suministrado por múltiples proveedores con diferentes precios y tiempos de entrega. Esta estructura es el requisito fundamental para que el sistema sugiera órdenes de compra automatizadas y optimizadas.

## 3. Conclusión Arquitectónica
Este diseño relacional asegura que la infraestructura de datos no solo soporta la toma de pedidos (OLTP), sino que está preparada para la extracción de analítica gerencial profunda (OLAP), cumpliendo integralmente con las expectativas del presupuesto y las consignas del proyecto.