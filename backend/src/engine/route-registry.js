// ============================================================
// route-registry.js
// Fuente única de verdad para el mapeo subcarpeta → prefijo HTTP
//
// Regla: el nombre de la clave DEBE coincidir exactamente con
// el nombre de la subcarpeta dentro de src/engine/schemas/
//
// Para agregar un módulo nuevo:
//   1. Crear la carpeta src/engine/schemas/mi-modulo/
//   2. Agregar la entrada aquí: 'mi-modulo': '/api/mi-modulo'
//   3. Agregar en index.js: app.route(RouteRegistry['mi-modulo'], miRouter)
// ============================================================

export const RouteRegistry = {
    'admin': '/api/admin',
    'kitchen': '/api/kitchen',
    'inventory': '/api/inventory',
    'public': '/api'
};