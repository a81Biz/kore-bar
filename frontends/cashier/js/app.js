// ============================================================
// cashier/js/app.js — Punto de entrada del Módulo de Caja
// ============================================================

import { TemplateLoader } from '/shared/js/templateLoader.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';
import { initLogin } from './logic.js';

import { loadEnv } from '/core/js/kore.env.js';
await loadEnv(); // antes de cualquier otra cosa — habilita waitForEnv() en logic.js

(async () => {
    // Cargar todos los parciales HTML antes de arrancar la lógica
    // El basePath vacío hace que TemplateLoader busque en /partials/
    await TemplateLoader.loadPartials(
        KORE_CONFIG.DOM.CASHIER.PARTIALS,
        ''   // cashier/index.html sirve desde la raíz del micrositio
    );

    initLogin();
})();