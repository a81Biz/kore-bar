# Kore Bar - Point of Sale (POS) & Restaurant Management System

<div align="center">

![Kore Bar](https://img.shields.io/badge/Kore_Bar-POS_System-ec5b13?style=for-the-badge)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-API-E36002?style=flat-square)
![Supabase](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat-square&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Local_Env-2496ED?style=flat-square&logo=docker)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-CLI-06B6D4?style=flat-square&logo=tailwindcss)
![Vitest](https://img.shields.io/badge/Vitest-Testing-729B1B?style=flat-square&logo=vitest)

**Sistema Integral de Punto de Venta y Gestión de Restaurantes**

*Arquitectura Serverless de Alta Concurrencia con Adaptador Híbrido PostgreSQL*

</div>

<br>

# Kore Bar - Point of Sale (POS) & Restaurant Management System
... (aquí sigue el resto del documento)

## 📌 Descripción General
**Kore Bar** es un sistema integral de Punto de Venta (POS) y gestión de restaurantes diseñado con una arquitectura orientada a micro-flujos y alta concurrencia. El sistema cubre todas las operaciones críticas de un establecimiento gastronómico: desde la toma de órdenes por parte de los meseros, gestión de cocina (KDS), control de inventarios y proveedores, hasta la administración centralizada de recursos humanos y catálogos.

La aplicación está dividida en un Frontend ligero (HTML/JS/CSS) y un Backend Serverless escalable desplegado en la red Edge de Cloudflare.

---

## 🛠️ Stack Tecnológico

### Frontend
* **Estructura:** HTML5 puro y Vanilla JavaScript. No utiliza frameworks pesados (Zero-bundler approach en la capa base).
* **Estilos:** **Tailwind CSS**. Optimizado mediante CLI sobre Docker para tener compilación en tiempo real (`--watch`) en desarrollo y archivos minificados (`--minify`) en producción, eliminando la dependencia del CDN.
* **Integración:** Plugin `@tailwindcss/forms` para estilización nativa de componentes de entrada.

### Backend (API)
* **Framework:** **Hono** (ligero, ultrarrápido y compatible con entornos Edge).
* **Entorno de Producción:** **Cloudflare Workers** (Serverless).
* **Entorno de Desarrollo:** **Node.js** encapsulado en contenedores **Docker**.
* **Testing:** **Vitest** (Suite de +140 pruebas de integración y unitarias).
* **Enrutamiento:** `SchemaRouter` dinámico para registro de Workflows por módulo.

### Base de Datos
* **Motor:** **PostgreSQL** alojado en **Supabase**.
* **Lógica de Negocio:** Altamente delegada a **Procedimientos Almacenados (Stored Procedures)** y vistas, lo que reduce la carga computacional en el backend (ej. `CALL sp_upsert_employee`).

---

## 🧩 Módulos del Sistema

El sistema expone una API RESTful organizada en los siguientes flujos de trabajo (Workflows):

1. **Módulo Admin (Empleados y Catálogos)**
   * Gestión de áreas y puestos (CRUD y operaciones *Bulk*).
   * Directorio de empleados y control de asistencia (Shifts/Turnos).
   * Sincronización PUSH/PULL de catálogos mediante Webhooks desde RRHH.
   * Gestión de Menú (Categorías y Platillos) y configuración del restaurante (Zonas y Mesas).
2. **Módulo Kitchen (Cocina - KDS)**
   * Pantalla de visualización de cocina (Board).
   * Gestión de recetas, ingredientes y fichas técnicas.
3. **Módulo Cashier (Caja)**
   * Procesamiento de pagos y generación de tickets.
   * Cortes Z y facturación electrónica (CFDI).
4. **Módulo Inventory (Inventario)**
   * Control de Kardex (Libro Mayor), stock y mermas.
   * Gestión de proveedores, listas de precios y traspasos de bodega.
5. **Módulo Public / Waiters (Servicio)**
   * Inicio de sesión con PIN para meseros.
   * Gestión de órdenes por mesa, entrega de platillos y menú público digital.

---

## 🧠 Soluciones Arquitectónicas Elegantes (Hitos del Desarrollo)

Durante el desarrollo, nos enfrentamos a desafíos técnicos severos relacionados con la arquitectura Serverless, los cuales se resolvieron mediante patrones de diseño avanzados sin sacrificar la base de código existente.

### 1. El Patrón "Proxy SQL" para Cloudflare Workers (El Adaptador Híbrido)
**El Problema:** Cloudflare Workers restringe severamente las conexiones TCP de larga duración y choca con la librería nativa `pg` (node-postgres), provocando cortes de conexión (`Connection terminated unexpectedly`) al intentar usar la base de datos Supabase. Reescribir los +140 métodos del backend para usar el SDK REST de Supabase hubiera significado meses de trabajo y el abandono de los Procedimientos Almacenados crudos.

**La Solución Elegante:** Se diseñó un único archivo de conexión (`connection.js`) que actúa como un enrutador inteligente (Factory):
* **En Desarrollo (Docker):** Detecta que corre en Node.js e inyecta la librería `pg` pura con un Pool de conexiones TCP directo.
* **En Producción (Cloudflare):** Envuelve las consultas SQL crudas (incluyendo `$1, $2`) utilizando un **interpolador seguro personalizado**. Luego, transmite ese SQL puro como una carga útil (payload) a través del protocolo HTTP usando el SDK de Supabase (`.rpc()`) hacia una función proxy construida en PostgreSQL (`kore_exec_sql`).
* **Resultado:** Se logró compatibilidad 100% Serverless sin modificar *una sola línea* de los modelos o la lógica de negocio.

### 2. Eliminación de Dependencias Locales (Tailwind en Docker)
**El Problema:** El uso de Tailwind vía CDN (`cdn.tailwindcss.com`) en producción generaba advertencias de rendimiento, pero el frontend no estaba configurado como un proyecto Node (`package.json`), lo que dificultaba la compilación clásica.
**La Solución Elegante:** Se levantó un contenedor Docker auxiliar (`node:alpine`) dedicado exclusivamente a ejecutar la CLI de Tailwind. Se implementó el modo `--watch` para compilar el CSS al vuelo durante el desarrollo al guardar archivos HTML, y un comando `--minify` para generar un `style.css` ultraligero y estático previo al despliegue en Cloudflare, manteniendo la máquina del desarrollador completamente limpia.

### 3. Sincronización y Resiliencia en Ingesta de Datos
El sistema utiliza transacciones *Bulk* (inserciones masivas) y Webhooks validados estructuralmente para inyectar y actualizar catálogos desde el departamento de RRHH. Se diseñaron "Gatekeepers" que rechazan datos anómalos (ej. fechas de ingreso incongruentes o posiciones inexistentes) en milisegundos, protegiendo la integridad referencial de la base de datos sin sobrecargar el flujo de eventos.

---

## 💻 Comandos de Desarrollo

**Levantar el entorno local completo (Backend + Base de datos + Tailwind Observer):**
```bash
docker compose up -d
```

**Ejecutar la suite de pruebas (Vitest):**
```bash
docker compose exec backend npm test -- --no-color
```

**Compilar estilos para Producción (Previo a despliegue en Cloudflare):**
```bash
docker compose run --rm tailwind npx tailwindcss -i ./input.css -o ./style.css --minify
```