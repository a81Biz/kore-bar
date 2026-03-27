// ============================================================
// views/reportes/index.js
// Orquestador: Monta submódulos, conecta eventos, expone API
// ============================================================
import { state }          from './state.js';
import { cacheDOM, render } from './view.js';
import { logic }          from './logic.js';

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
const _bindEvents = () => {
    // A) ESTÁTICOS — filtro y exportación
    state.dom.btnFilter.addEventListener('click', logic.loadAll);
    state.dom.btnExport.addEventListener('click', logic.exportCSV);

    // B) DINÁMICOS — delegación en tabs
    state.dom.tabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.report-tab');
        if (tab) {
            const tabName = tab.getAttribute('data-tab');
            logic.switchTab(tabName);
        }
    });
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const ReportesController = {
    mount: async (container) => {
        cacheDOM(container);
        _bindEvents();
        // Carga automática con el rango default (último mes)
        await logic.loadAll();
    },
    refresh: async () => await logic.loadAll()
};
