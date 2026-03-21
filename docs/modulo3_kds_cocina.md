# Diseño de Interfaces: Módulo Kitchen Display System (Cocina)

## Justificación Arquitectónica
La cocina es un entorno hostil para el hardware convencional (calor, humedad, grasa). La interfaz debe ejecutarse en una PC conectada a una pizarra interactiva táctil. El diseño debe basarse en alto contraste, tipografía de gran tamaño y botones de área amplia para mitigar errores de pulsación, eliminando por completo el uso de teclado y ratón.

## W06 - Pizarra de Comandas Activas
* **Descripción Interna:** Tablero estilo Kanban adaptado. Cada orden entrante se muestra como un bloque (*ticket*) ordenado cronológicamente. Contiene: Número de mesa, hora de recepción (timestamp), nombre del mesero y lista de platillos. Cada platillo tiene un botón táctil adyacente que dice "Listo".
* **Función:** Orquestar el flujo de trabajo de los 5 cocineros. Registrar la hora de finalización del plato para calcular tiempos de preparación.
* **Conexión de Datos:** Recibe eventos en tiempo real desde la **Toma de Pedidos (W04)**. Al presionar "Listo", actualiza la base de datos con el *timestamp* de fin y envía una notificación *Push* de regreso a la tableta del mesero. Además, alimenta de forma pasiva el proceso *batch* del **Consumo Diario (W12)** de inventarios.