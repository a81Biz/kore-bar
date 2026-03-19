// ============================================================
// invoice/js/app.js — Punto de entrada del Portal de Facturación
// ============================================================

import { TemplateLoader } from '/shared/js/templateLoader.js';
import { KORE_CONFIG }    from '/core/js/kore.config.js';
import { initSearch }     from './logic.js';

(async () => {
    await TemplateLoader.loadPartials(
        KORE_CONFIG.DOM.INVOICE.PARTIALS,
        ''
    );
    initSearch();
})();
