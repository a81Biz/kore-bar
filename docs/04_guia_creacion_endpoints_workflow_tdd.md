He releído cuidadosamente todo nuestro progreso. Tienes toda la razón: la arquitectura evolucionó drásticamente en los últimos pasos. Logramos eliminar los controladores manuales, le dimos al `SchemaRouter` el poder de ser un "Gatekeeper" (cadenero) automático, y convertimos al archivo JSON en el **Único Jefe** (Single Source of Truth - SSOT) que dicta qué datos entran, qué se rechaza y cómo se documenta todo automáticamente en Swagger.

La guía actual que me compartes tiene fragmentos desactualizados (como la Sección 5 que habla de crear controladores manualmente, cosa que ya no hacemos).

Aquí tienes la **versión definitiva y actualizada de tu Guía 04**. He reescrito las secciones para reflejar la realidad de tu arquitectura actual, haciendo especial énfasis en el SSOT y la autogeneración de Swagger.

---

# Guía: Creación de Endpoints usando TDD y Workflow Engine

Este documento establece el estándar arquitectónico de "Kore Bar" para la creación de nuevos flujos de negocio (endpoints). Nuestro ecosistema requiere el uso de **Test-Driven Development (TDD)** combinado con un **Workflow Engine** declarativo, validación centralizada por esquemas (SSOT) y delegación transaccional a la Base de Datos.

## 0. Convenciones de Datos y Nomenclatura (Reglas de Oro)

* **Cero Spanglish en el Backend:** Todo payload que viaje en la red, variables de entorno, y esquemas de base de datos DEBEN estar en inglés estricto (ej. `employeeNumber`, `areaId`, `isActive`).
* **Nombres de Archivos:** Todo archivo del backend (rutas, modelos, helpers, schemas) debe usar `kebab-case` estricto (ej. `admin-employee.helper.js`, `create-employee.schema.json`).
* **Enrutador Dinámico (SchemaRouter):** **No se escriben rutas HTTP ni controladores manualmente**. Las rutas se registran e inyectan automáticamente en el arranque del servidor leyendo las propiedades `api` de los archivos `.schema.json` del motor.
* **Base de Datos (PostgreSQL):** La lógica delegada a la base de datos se clasifica de forma estricta:
* **`sp_` (Stored Procedure):** Para mutaciones (INSERT, UPDATE, DELETE). Se invocan a través de la capa de modelos. No devuelven tablas.
* **`fn_` (Function):** Para lecturas atómicas, verificaciones de existencia o cálculos. Devuelven datos y se invocan con `SELECT`.
* **`vw_` (View):** Para consultas de aplanado, lectura y cruces de tablas relacionales (JOINs, Pivot Tables). Exponen llaves en `snake_case` que se mapean al Frontend.
* Los JSON Schemas y el Frontend jamás exponen ni envían UUIDs. Todo payload usa la Llave Natural (code). Es responsabilidad exclusiva del Stored Procedure recibir el code, buscar su UUID interno y realizar la mutación"



## 1. Escribir el Test Primero (TDD)

Antes de escribir una sola línea lógica, debes crear el archivo de prueba en `backend/tests/`.

* **Qué probar:** Valida que el endpoint (`POST /api/...`) devuelva `200 OK`, y también prueba los casos de rechazo (`400 Bad Request`, `404 Not Found`).
* **Limpieza (Teardown):** Utiliza el hook `afterAll` de Vitest para ejecutar consultas SQL (ej. `DELETE FROM ...`) que eliminen los datos mockeados generados. **Esto es crucial para no contaminar la base local de PostgreSQL.**

## 2. El Esquema JSON como Única Fuente de Verdad (SSOT)

El archivo `backend/src/engine/schemas/tu-flujo.schema.json` ya no solo define los pasos del Workflow; ahora es el **contrato estricto y único (SSOT)** de tu API.

Debes incluir el bloque `"api"`. Este bloque sirve para 3 cosas automáticamente:

1. **Enrutamiento:** Monta la ruta en Hono.
2. **Gatekeeper (Sanitización):** El `SchemaRouter` validará que los campos de `"required"` existan y sean del tipo correcto antes de ejecutar el Workflow. Si fallan, devuelve un error 400 sin tocar tu código JavaScript.
3. **Swagger:** Genera la documentación visual.

**Ejemplo obligatorio del bloque API:**

```json
{
    "id": "create_employee",
    "name": "Create Employee",
    "description": "Crea un empleado nuevo.",
    "api": {
        "method": "POST",
        "path": "/employees",
        "body": {
            "properties": {
                "firstName": { "type": "string", "example": "Juan" },
                "areaId": { "type": "string", "example": "20" }
            },
            "required": ["firstName", "areaId"]
        }
    },
    "startAt": "tu_primer_nodo",
    "nodes": { ... }
}

```

## 3. Crear la Lógica (Procedimientos Almacenados, Models & Helpers)

El backend en Node.js es ligero. Tu código JS asume que **el payload ya viene limpio y validado** por el Gatekeeper del paso anterior.

* **La Base de Datos:** Toda lógica que implique múltiples inserciones (Upserts) o validación atómica **DEBE** aislarse en un Procedimiento Almacenado en PostgreSQL (`CALL sp_upsert_...`).
* **El Modelo (`.model.js`):** Queda estrictamente prohibido anidar sentencias SQL crudas con lógica de negocio. El modelo se limita a mapear variables e invocar: `await executeStoredProcedure(c, 'sp_mi_procedimiento', { p_variable: emp.variable })`.
* **El Helper (`.helper.js`):** Su responsabilidad es recibir el `state.payload` (que ya fue sanitizado por el JSON Schema), aplicar lógicas de negocio exclusivas (ej. concatenar IDs para formar un `positionCode`) y pasarlo al Modelo.

## 4. Registrar las Acciones

El motor de flujo de trabajo *nunca* entiende de código; solo lee cadenas del JSON.
Acude a `backend/src/engine/registry.js` e integra las funciones creadas (Helpers) asociándolas a las keys ("saveEmployee", "notifyKDS", etc.) requeridas por el nodo `handler` del esquema.

## 5. Documentación Viva y Automática (Swagger / OpenAPI)

**Queda prohibido escribir documentación manual de la API.**
Nuestro ecosistema utiliza un generador dinámico. Al arrancar el servidor, el motor lee automáticamente todos los bloques `"api"` de tus archivos `*.schema.json` y levanta una interfaz visual Swagger interactiva.

* **URL de Documentación:** `http://localhost:8000/api/docs` (o el puerto configurado).
* **Mantenimiento:** Si el negocio pide un nuevo campo obligatorio (ej. `rfc`), **NO** modificas las validaciones en JavaScript. Simplemente agregas `"rfc"` a la lista `"required"` del archivo `.schema.json`. El `SchemaRouter` comenzará a rechazar peticiones incompletas y Swagger se actualizará mostrando el nuevo campo, todo desde una sola fuente de verdad.

---

Revísala y dime si captura exactamente la esencia de nuestra arquitectura actual. Si te parece bien, reemplaza tu archivo `04_guia...` con este texto y procedemos a atacar el primer recuadro blanco de nuestra lista de Tests (TDD).