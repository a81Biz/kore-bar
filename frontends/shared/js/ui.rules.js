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
        // Limpieza completa. El refresh de zonas lo dispara logic.cargarDatos()
    },

    'form-piso-mesa': {
        // El selector de zona se conserva para ráfaga de captura:
        // el gerente registra varias mesas en la misma zona sin reseleccionar.
        // ⚠️ ID verificado contra _piso.html: <select id="mesa-zona-unica">
        preserveFields: ['mesa-zona-unica']
    },

    'form-piso-asignacion': {
        // El puesto se conserva para asignar al siguiente mesero sin reseleccionar.
        // ⚠️ ID verificado contra _piso.html: <select id="asig-puesto">
        preserveFields: ['asig-puesto']
    },

    // ── MÓDULO MENÚ ───────────────────────────────────────────────────────────
    'form-menu-categoria': {
        preserveFields: []
        // Limpieza completa. El refresh de categorías lo publica PubSub CATEGORIAS_ACTUALIZADAS
    },

    'form-menu-platillo': {
        // La categoría se conserva para alta masiva de platillos del mismo tipo.
        // ⚠️ ID verificado contra _menu.html: <select id="plat-category">
        preserveFields: ['plat-category']
    },

    'form-review-comercial': {
        preserveFields: []
        // El drawer se resetea al cerrar vía render.closeDrawer()
    },

    // ── MÓDULO INVENTARIO ─────────────────────────────────────────────────────
    'form-inv-supplier': {
        preserveFields: []
        // La restauración del proveedor activo se maneja con setTimeout(render.suppliers, 50)
        // en el controlador porque es estado interno (state.ui.selectedSupplierCode),
        // no un campo del formulario.
    },

    'form-supplier-price': {
        preserveFields: []
        // Los campos se limpian. El estado readOnly/disabled del buscador
        // se restaura manualmente en el controlador tras el submit.
    },

    'form-transfer': {
        preserveFields: []
        // Modal de traspaso, limpieza completa al confirmar o cerrar.
    },

    'form-adjustment': {
        preserveFields: []
        // Modal de ajuste físico, limpieza completa al confirmar o cerrar.
    },

    // ── MÓDULO EMPLEADOS ──────────────────────────────────────────────────────
    'form-edit-empleado': {
        preserveFields: []
        // La modal se resetea mediante render.modalClose() que llama a form.reset()
    }
};