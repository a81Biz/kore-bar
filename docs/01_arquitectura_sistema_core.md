# 01 - Arquitectura Base: Sistema Core y Micro-Frontends

## Visión General
**Kore Bar OS** no es una aplicación monolítica tradicional. Está diseñado bajo una arquitectura de **Micro-Frontends (MFE)**. Esto significa que el sistema está dividido en múltiples aplicaciones independientes (Administración, Cocina, Caja, Menú de Comensales) que operan bajo sus propios subdominios, pero comparten un "cerebro" y utilidades comunes.

Esta decisión arquitectónica permite que distintos equipos puedan desarrollar, desplegar y mantener módulos específicos sin afectar el resto del sistema, garantizando alta disponibilidad y tolerancia a fallos.

## 1. El Portal Maestro (App Shell)
El corazón de la arquitectura reside en la carpeta `frontends/core/`. Este directorio funciona como el **App Shell** (Cascarón de la Aplicación) y el lanzador principal.
* **Portal Cautivo (`index.html`):** Al ingresar a la raíz del sistema (`localhost`), el servidor no carga un módulo específico, sino un portal de presentación que detecta el estado general del sistema y ofrece enlaces de acceso a los micrositios habilitados.

## 2. El Orquestador (`kore.core.js`)
Ningún micrositio arranca por sí solo. Todos los archivos `index.html` del ecosistema delegan su inicialización al script global `/core/js/kore.core.js`.
* **Detección Dinámica:** El Core lee el subdominio actual (ej. `admin.localhost`) y determina qué módulo debe inyectarse.
* **Interruptor Maestro (Kill Switch):** Si un módulo está marcado como `enabled: false` en la configuración global, el Core bloquea la ejecución del código del micrositio y renderiza una pantalla de "Fuera de Línea" (Fallback de seguridad), protegiendo al usuario de errores.

## 3. El Diccionario Global (`kore.config.js`)
Para erradicar la deuda técnica de los *Magic Strings* (textos quemados en el código), el sistema utiliza un diccionario centralizado.
* Controla el estado (`enabled / disabled`) de cada micrositio.
* Almacena las referencias exactas (IDs y Clases) del DOM. Si un contenedor HTML cambia de nombre, solo se actualiza en este diccionario y todos los controladores JS se ajustan automáticamente.

## 4. Infraestructura de Red (Nginx)
El enrutamiento de los Micro-Frontends está respaldado por un proxy inverso (Nginx). 
Para evitar la duplicación de código, Nginx intercepta las peticiones de cualquier subdominio (`*.localhost`) y mapea virtualmente (mediante la directiva `alias`) las carpetas `/core/` y `/shared/`. Esto permite que el micrositio de Administración y el de Cocina puedan importar el mismo `kore.core.js` como si estuviera dentro de su propio directorio.

## 5. Integración Híbrida (Vanilla JS y React)
El Core está diseñado para soportar múltiples tecnologías en sus módulos "Lego". Mientras que el módulo de Administración utiliza Vanilla JS de alto rendimiento, módulos como el **Menú QR** utilizan React compilado en tiempo real (Babel). El Core gestiona estas asimetrías de tiempo de carga mediante técnicas de *Polling* antes de autorizar el renderizado visual.