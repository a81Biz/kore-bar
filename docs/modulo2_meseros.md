# Diseño de Interfaces: Módulo App Tablet (Meseros)

## Justificación Arquitectónica
Este módulo actúa como el nodo transaccional principal de la operación en piso. Está diseñado para ejecutarse en tabletas táctiles bajo la misma red local inalámbrica. Su prioridad es la velocidad de captura y la concurrencia, asegurando que las peticiones se serialicen correctamente con un *timestamp* exacto para evitar cuellos de botella en la base de datos.

## W02 - Login Simplificado
* **Descripción Interna:** Pantalla de autenticación minimalista. Utiliza un teclado numérico grande en pantalla para el ingreso de un PIN de 4 a 6 dígitos.
* **Función:** Identificar rápidamente al mesero en turno sin fricciones cognitivas.
* **Conexión de Datos:** Valida las credenciales contra el catálogo de usuarios del sistema web y recupera el token de sesión asociado a su ID.

## W03 - Mapa de Mesas Asignadas (Home)
* **Descripción Interna:** Cuadrícula dinámica que muestra únicamente las mesas que el administrador asignó al mesero en su turno actual. Usa códigos de color para el estado (Verde: Libre, Rojo: Ocupada, Amarillo: Esperando cuenta).
* **Función:** Concentrar la atención del trabajador solo en su área de responsabilidad, reduciendo errores de cruce de comandas.
* **Conexión de Datos:** Consulta (GET) al módulo de **Asignación de Meseros (W09)**. 

## W04 - Toma de Pedidos
* **Descripción Interna:** Interfaz de punto de venta (POS). Lado izquierdo: categorías y platillos con botones táctiles grandes. Lado derecho: desglose de la comanda actual (*ticket virtual*), subtotal y botón de "Enviar Orden".
* **Función:** Registrar la petición del cliente generando el *timestamp* de inicio. Debe indicar visualmente mediante un ícono qué productos van a preparación (KDS) y cuáles se despachan directamente del frigorífico.
* **Conexión de Datos:** Al enviar, realiza un POST a la base de datos. Dispara un evento (WebSocket o Long Polling) hacia la **Pizarra de Cocina (W06)** para los platillos elaborados.

## W05 - Cierre de Mesa y Solicitud de Cuenta
* **Descripción Interna:** Vista de resumen de la cuenta total. Muestra la lista final de consumos, la suma total e incluye un botón de "Imprimir Ticket y Cerrar Mesa".
* **Función:** Dar por finalizado el servicio en piso y transferir el control de la transacción al módulo de caja.
* **Conexión de Datos:** Actualiza el estado de la mesa a "Libre" (W03) y envía la orden de impresión por red local hacia la **Caja (W13)**.