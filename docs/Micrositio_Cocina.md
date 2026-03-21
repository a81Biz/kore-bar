# Micrositio: Cocina (kitchen.sitio)

Este documento define el alcance y los requerimientos funcionales para el Micrositio de Cocina del Restaurante. Este micrositio está diseñado para ser utilizado en la **pizarra interactiva de la cocina**, permitiendo a los cocineros visualizar, gestionar y actualizar el estado de los platillos solicitados en tiempo real.

---

## Parte 1: Requerimientos Originales del Negocio

*Basado estrictamente en el Planteamiento del Problema.*

El sistema debe proveer una interfaz para que el personal de cocina pueda realizar las siguientes tareas:

1. **Visualización de Pedidos:** Mostrar en una pizarra interactiva los platillos solicitados por los comensales, ordenados por hora y mesa.
2. **Gestión de Preparación:** Permitir a los cocineros marcar los platillos que han sido terminados una vez que se han preparado.
3. **Registro de Finalización:** Registrar automáticamente la hora en la que cada platillo es marcado como terminado.
4. **Notificación a Meseros:** Una vez que un platillo esté listo, el sistema debe notificar al mesero correspondiente para que pase a recogerlo.
5. **Soporte para Flujo de Servicio:** Mantener una visualización clara del estado de los pedidos para evitar confusiones y asegurar que los platillos se preparen en el orden adecuado.

---

## Parte 2: Mejoras Funcionales y de Negocio (Kore Bar)

*Optimizaciones añadidas al requerimiento original para garantizar eficiencia operativa.*

1. **Tablero de Producción Dinámico (Kitchen Display System):** La pizarra interactiva funciona como un tablero de producción que actualiza automáticamente los pedidos entrantes desde el sistema de meseros. Los platillos se organizan dinámicamente por prioridad (hora de pedido).
   
2. **Estados de Preparación:** En lugar de manejar únicamente el estado "listo", cada platillo puede pasar por diferentes estados operativos:
   - Pendiente
   - En preparación
   - Listo para servir
   
   Esto permite al equipo de cocina coordinar mejor el trabajo entre los cocineros.

3. **Identificación Visual por Mesa y Pedido:** Cada orden mostrará de forma clara:
   - Número de mesa
   - Hora del pedido
   - Mesero responsable
   - Lista de platillos solicitados
   
   Esto permite mantener la trazabilidad del pedido y evitar errores de entrega.

4. **Notificación Automática a Meseros:** Cuando un platillo cambia al estado "Listo", el sistema enviará automáticamente una notificación al dispositivo del mesero asignado.

5. **Separación de Platillos de Cocina y Productos Directos:** El sistema identificará automáticamente los productos que **no requieren preparación en cocina** (bebidas, pan, algunos postres) para evitar que aparezcan en el tablero de cocina.

---

## Parte 3: Mapa de Interfaces Funcionales (Agrupación de Vistas)

El micrositio se organiza en módulos funcionales diseñados para facilitar la operación dentro de la cocina.

### 🟢 Grupo 1: Módulos Base (Completados / En desarrollo activo)

* **K01 - Login de Personal de Cocina:** Interfaz de acceso para cocineros y jefe de cocina. Este acceso también registra automáticamente el "Clock-in" del empleado para el control de asistencia.

* **K02 - Tablero de Pedidos (Kitchen Board):** Vista principal en la pizarra interactiva donde se muestran los pedidos activos organizados por hora y mesa. Permite cambiar el estado de cada platillo mediante interacción táctil.

---

### 🟡 Grupo 2: Módulos Operativos (Pendientes de construcción)

* **K03 - Gestión de Estados de Preparación:** Interfaz para actualizar el estado de cada platillo (Pendiente, En preparación, Listo).

* **K04 - Notificación de Platillos Terminados:** Módulo que comunica automáticamente al sistema de meseros cuando un platillo ha sido marcado como listo.

* **K05 - Panel del Jefe de Cocina:** Vista administrativa accesible desde el mismo micrositio donde el jefe de cocina puede:
  - Supervisar el flujo de pedidos
  - Revisar tiempos promedio de preparación
  - Detectar acumulación de órdenes en cocina

* **K06 - Integración con Inventario:** Registro indirecto de consumo de alimentos basado en los platillos preparados durante el día. Esta información será utilizada posteriormente por el módulo de inventario del sistema administrativo.

---
