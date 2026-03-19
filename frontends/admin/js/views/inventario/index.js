// frontends/admin/js/views/inventario/index.js
import { cacheDOM, render } from './view.js';
import { bindEvents, api } from './logic.js';
import { showErrorModal } from '/shared/js/ui.js';

export const InventarioController = {
    mount: async (container) => {
        cacheDOM(container);
        bindEvents();
        render.switchTab('suppliers'); // Pestaña por defecto

        try {
            await Promise.all([
                api.loadSuppliers(),
                api.loadStock(),
                api.loadKardex()
            ]);
        } catch (error) {
            console.error('[Inventario] Error inicial:', error);
            showErrorModal('No se pudo conectar con el servidor de base de datos.');
        }
    }
};