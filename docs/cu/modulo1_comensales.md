# Diseño de Interfaces: Módulo App Móvil (Comensales)

## Justificación Arquitectónica
El módulo de comensales está diseñado bajo el patrón de cliente ligero (*thin client*). Dado que los usuarios accederán a través de sus propios dispositivos móviles mediante el escaneo de un código QR, la interfaz debe ser estrictamente de solo lectura (*read-only*) y altamente responsiva (Mobile-First). Esto elimina la necesidad de instalación de software de terceros y reduce la carga en la red local del restaurante.

## W01 - Vista de Menú Digital Responsivo
* **Descripción Interna:** Interfaz que presenta el catálogo gastronómico del restaurante. Contiene un encabezado con el logotipo, categorías colapsables (ej. Entradas, Platos Fuertes, Bebidas, Postres) y tarjetas de producto (*cards*) que muestran fotografía, nombre, descripción de ingredientes y precio final (IVA incluido).
* **Función:** Eliminar el uso de menús físicos y garantizar que los comensales siempre visualicen los precios y platillos actualizados en tiempo real.
* **Conexión de Datos:** Se conecta de forma unidireccional (GET) a la base de datos central. Consume la información directamente del módulo de **Gestión de Menú (W10)** administrado por la gerencia. Cualquier actualización en el catálogo se refleja instantáneamente en esta vista.