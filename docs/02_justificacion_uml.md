# Justificación Técnica de Diagramas UML

## 1. Introducción
Para cumplir con las fases de análisis y diseño de la solución, se ha seleccionado un conjunto de diagramas del Lenguaje Unificado de Modelado (UML) que abordan el sistema desde tres perspectivas fundamentales: comportamiento, interacción y estructura. Esta selección optimiza el tiempo de documentación mientras provee directrices claras para el desarrollo del código fuente.

## 2. Diagramas de Comportamiento
* **Diagrama de Casos de Uso:** * *Justificación:* Define las fronteras del sistema. Al modelar la interacción entre los actores (Gerente, Mesero, Cocinero, Cajero, Comensal) y los módulos, se garantiza que la cobertura del código responda estrictamente a las necesidades del negocio (Toma de pedidos, Zonificación, Facturación, Inventarios).
* **Diagrama de Actividad (Proceso de Cocina):** * *Justificación:* Mapea la lógica condicional crítica. Demuestra cómo el sistema bifurca el flujo de trabajo basándose en atributos booleanos (ej. `requiere_cocina`), guiando el desarrollo de los algoritmos de despacho directo (frigorífico) versus preparación en línea (KDS).

## 3. Diagramas de Interacción
* **Diagramas de Secuencia (Pedidos y Aprovisionamiento):** * *Justificación:* Representan la topología temporal de las peticiones HTTP y eventos bidireccionales. El diagrama de pedidos define el contrato de la API REST (endpoints y payloads) y el uso de WebSockets para notificaciones asíncronas entre la tableta y la cocina. El diagrama de aprovisionamiento modela la interacción del proceso *batch* y los motores de optimización de compras.

## 4. Diagramas de Estructura
* **Diagrama de Clases:** * *Justificación:* Actúa como el plano arquitectónico para el paradigma de Programación Orientada a Objetos (POO). Define las entidades de software, encapsulación, atributos y métodos antes de su mapeo a bases de datos relacionales (ORM).
* **Diagrama de Componentes:** * *Justificación:* Valida la viabilidad de la infraestructura de red. Demuestra cómo los artefactos de software (Micro-Frontends, Servidor WebSocket, Base de Datos, APIs externas del SAT) interactúan dentro de la red LAN inalámbrica de 200 Mbps estipulada en los requerimientos del proyecto.