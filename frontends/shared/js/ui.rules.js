// shared/js/ui.rules.js
//
// Fuente de verdad para el comportamiento post-submit de FormEngine.
// preserveFields: lista de IDs HTML que NO se limpian tras un submit exitoso.
// Los IDs deben coincidir EXACTAMENTE con el atributo id del elemento en el HTML.
//
// Ver doc: 06_matriz_reglas_interaccion_ui.md — Tabla Maestra de UIRules

export const UIRules = {

    // ── MÓDULO PISO ───────────────────────────────────────────────────────────
    'form-piso-zona': {
        preserveFields: []
    },

    'form-piso-mesa': {
        // ⚠️ ID verificado contra _piso.html: <select id="mesa-zona-unica">
        preserveFields: ['mesa-zona-unica']
    },

    'form-piso-asignacion': {
        // ⚠️ ID verificado contra _piso.html: <select id="asig-puesto">
        preserveFields: ['asig-puesto']
    },

    // ── MÓDULO MENÚ ───────────────────────────────────────────────────────────
    'form-menu-categoria': {
        preserveFields: []
    },

    'form-menu-platillo': {
        // ⚠️ ID verificado contra _menu.html: <select id="plat-category">
        preserveFields: ['plat-category']
    },

    'form-review-comercial': {
        preserveFields: []
    },

    // ── MÓDULO INVENTARIO ─────────────────────────────────────────────────────
    'form-inv-supplier': {
        preserveFields: []
    },

    'form-supplier-price': {
        preserveFields: []
    },

    'form-transfer': {
        preserveFields: []
    },

    'form-adjustment': {
        preserveFields: []
    },

    // ── MÓDULO EMPLEADOS ──────────────────────────────────────────────────────
    'form-edit-empleado': {
        preserveFields: []
    },

    // ── MÓDULO COCINA — RECETAS ───────────────────────────────────────────────
    'form-kitchen-ingredient': {
        // Formulario de nuevo insumo en el BOM Builder.
        // Se limpia completamente tras cada ingrediente añadido para ráfaga de captura.
        // ⚠️ IDs verificados contra _recetas.html: #ing-code, #ing-name, #ing-unit, #ing-qty
        preserveFields: []
    },

    'form-tech-sheet': {
        // Ficha técnica de preparación (método + imagen).
        // Se limpia completamente al guardar — el usuario selecciona otro platillo desde la lista.
        // ⚠️ IDs verificados contra _recetas.html: #tech-prep-method, #tech-img-upload
        preserveFields: []
    }
};