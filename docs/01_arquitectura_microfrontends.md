# Justificación Arquitectónica: Evolución de Wireframes a Micro-Frontends

## 1. Introducción
En las etapas iniciales de diseño de software, los *wireframes* estáticos cumplen la función de validar la disposición de elementos (layout). Sin embargo, para un sistema de gestión restaurantera de alta concurrencia, la validación de la experiencia de usuario (UI/UX) y los flujos transaccionales requiere interactividad. Por ello, se ha decidido evolucionar la entrega de la Consigna C hacia un **Prototipo Funcional de Alta Fidelidad** basado en el patrón arquitectónico de **Micro-Frontends**.

## 2. El Enfoque Modular (Separación por Sitios)
En lugar de construir una aplicación monolítica (*Single Page Application* gigante), el sistema se ha fragmentado en cinco subdominios o aplicaciones independientes, cada una con un propósito único. Esta modularización garantiza soluciones escalables y mantenibles:

* **`menu` (App Comensal):** Arquitectura *Mobile-First* estricta y de solo lectura. Optimiza el consumo de recursos de red (thin-client) al no cargar librerías innecesarias de gestión.
* **`waiters` (Terminal POS):** Diseñado para máxima velocidad táctil. Implementa autenticación ultrarrápida (PIN numérico) en lugar de tokens JWT pesados, minimizando la fricción operativa en piso.
* **`kitchen` (KDS):** Opera como una terminal tipo Kiosco de alto contraste (Dark Mode). Su aislamiento previene que los procesos pesados de renderizado gráfico de otras áreas afecten su actualización en tiempo real mediante WebSockets.
* **`admin` (Dashboard Gerencial):** Arquitectura *Desktop-First* enfocada en la densidad de datos. Concentra la carga computacional pesada (gráficos de analítica, cálculos de nómina, CRUD de catálogos).
* **`cashier` (Punto de Cobro y CFDI):** Aislado por requerimientos de seguridad y auditoría. Centraliza el manejo de pasarelas de pago y la comunicación con las APIs del SAT, protegiendo los datos fiscales del resto de la red local.

## 3. Ventajas de la Solución Modular
1. **Seguridad por Aislamiento:** Al separar los puntos de entrada, un mesero no tiene en su caché ni en su dispositivo código relacionado con facturación o configuración de inventarios.
2. **Despliegue Independiente (CI/CD):** Permite actualizar el menú digital sin tener que detener o reiniciar el sistema KDS de la cocina.
3. **Resiliencia Operativa:** Si el módulo administrativo sufre una caída por procesamiento pesado de reportes, la operación en piso (toma de pedidos y preparación) continúa funcionando de manera ininterrumpida a través de la red local.