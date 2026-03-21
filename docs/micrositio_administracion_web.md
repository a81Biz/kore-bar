# Micrositio: Administración Web (admin.sitio)

Este documento define el alcance y los requerimientos funcionales para el Micrositio de Administración del Restaurante. Al tratarse de tareas de gestión intensivas (inventarios, personal, catálogos), se diseña para entornos de escritorio (PCs en la oficina administrativa y terminales de caja).

---

## Parte 1: Requerimientos Originales del Negocio

*Basado estrictamente en el Planteamiento del Problema.*

El sistema debe proveer una interfaz para que el Gerente pueda realizar las siguientes tareas:

1. **Gestión de Piso:** Configurar el número de mesas y asignar a los meseros por turno.
2. **Control de Personal:** Obtener la información de los meseros del subsistema de recursos humanos y registrar inasistencias para aplicar descuentos.
3. **Gestión de Menú:** Registrar los nuevos platillos.
4. **Reportes de Ventas:** Consultar una lista ordenada por mesas con el resumen de ventas y meseros asignados en un periodo de tiempo.
5. **Caja y Facturación:** Recepción del pago e impresión de recibos. Emisión de facturas desglosando el IVA e incluyendo datos fiscales (RFC, CP, Régimen, Uso de CFDI, Correo).
6. **Aprovisionamiento e Inventario:** Interfaz para el jefe de cocina para pedir alimentos. Búsqueda automática del proveedor más adecuado (precio/tiempo) y cálculo de consumo diario basado en platillos elaborados.

---

## Parte 2: Mejoras Funcionales y de Negocio (Kore Bar)

*Optimizaciones añadidas al requerimiento original para garantizar eficiencia operativa.*

1. **Sincronización Dinámica de RRHH (Master Data Management):** En lugar de capturar empleados a mano, el sistema se sincroniza con un archivo maestro de Recursos Humanos. Los catálogos de jerarquía (Áreas y Puestos) se construyen y actualizan dinámicamente, evitando errores de captura.
2. **Control de Asistencia Automatizado (Login/Logout):** Se elimina el registro manual de inasistencias por parte del gerente. El sistema registrará la entrada ("Clock-in") automáticamente cuando el empleado inicie sesión por primera vez en el día en su micrositio correspondiente (Cocina, Meseros, Caja, Admin), y registrará la salida ("Clock-out") al cerrar sesión.
3. **Desacoplamiento del Módulo de Caja:** Se divide funcionalmente la operación. La Caja y la Facturación operarán como una entidad independiente en el punto de venta (evitando cuellos de botella en la oficina administrativa), y estarán preparadas para conectarse a un PAC del SAT para el timbrado real de facturas.

---

## Parte 3: Mapa de Interfaces Funcionales (Agrupación de Vistas)

El micrositio se organiza en módulos funcionales. A continuación, el estado de nuestra construcción:

### 🟢 Grupo 1: Módulos Base (Completados / En desarrollo activo)

* **W07 & W08 - Login y Dashboard:** Interfaz de acceso seguro y panel de métricas clave (ventas del día, mesas activas).
* **W09 - Gestión de Piso (Zonas, Mesas y Asignación):** Panel unificado para crear áreas físicas (Zonas), dar de alta mesas y asignar meseros activos a los turnos (Matutino/Vespertino) previniendo colisiones de personal.
* **W11 - Gestión de Empleados (Directorio):** Directorio central de personal sincronizado con RRHH. Permite visualizar el estado activo/inactivo, el área y el puesto de cada empleado.

### 🟡 Grupo 2: Módulos Operativos (Pendientes de construcción)

* **W10 - Gestión de Menú (Catálogo de Platillos):** Formularios para alta, baja y edición de platillos (precio, categoría, receta base). Será la fuente de verdad para el menú digital (QR) y las tabletas de los meseros.
* **W11.b - Control de Asistencia y Reporte de Faltas:** Interfaz de solo lectura para el gerente, donde podrá revisar los reportes de "Clock-in/Clock-out" automatizados y consolidar las faltas para la nómina.
* **W12 - Gestión de Inventario y Aprovisionamiento:** Panel para el Jefe de Cocina. Mostrará el stock actual y ejecutará el algoritmo de sugerencia de compras a proveedores cruzando precio y tiempo de entrega.
* **W13 - Módulo de Caja y Facturación (Punto de Venta):** Panel de recepción de pagos de mesas cerradas y formulario fiscal para la emisión de CFDI.
* **W14 - Reportes de Ventas:** Generador de reportes históricos con filtros cruzados por fecha, turno y empleado.

