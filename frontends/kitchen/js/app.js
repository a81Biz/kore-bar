// frontends/kitchen/js/app.js
import { PubSub } from '/shared/js/pubsub.js';
import { viewManager } from '/shared/js/viewManager.js';
import { TemplateLoader } from '/shared/js/templateLoader.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';

import { KdsController } from './views/kds/index.js';
import { RecetasController } from './views/recetas/index.js';
import { InventarioController } from './views/inventario/index.js';
import { PinChecadorController } from './views/kds/pin-checador.js';

// ==========================================================================
// 1. DICCIONARIO DE RUTAS
// ==========================================================================
const Routes = {
    'kds': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.KITCHEN.TEMPLATES.KDS);
        KdsController.mount(root);
    },
    'recetas': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.KITCHEN.TEMPLATES.RECETAS);
        RecetasController.mount(root);
    },
    'inventario': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.KITCHEN.TEMPLATES.INVENTARIO);
        InventarioController.mount(root);
    }
};

// ==========================================================================
// 2. ORQUESTADOR
// ==========================================================================
const App = {
    async init() {
        console.log('[Kitchen] Iniciando secuencia de arranque de la SPA...');

        // A: Pre-cargar todos los templates HTML
        await TemplateLoader.loadPartials(KORE_CONFIG.DOM.KITCHEN.PARTIALS, '');

        // B: Montar el panel del checador en el modal-container
        //    (debe hacerse DESPUÉS de loadPartials para que el template exista)
        const modalContainer = document.getElementById('modal-container');
        const modalTemplate = document.getElementById(KORE_CONFIG.DOM.KITCHEN.TEMPLATES.MODAL_PIN);

        if (modalContainer && modalTemplate) {
            modalContainer.appendChild(modalTemplate.content.cloneNode(true));
        }

        // C: Inicializar el PinChecadorController UNA sola vez.
        //    Cachea DOM + carga empleados. El panel permanece oculto hasta
        //    que alguien publique OPEN_MODAL con 'pin-modal'.
        await PinChecadorController.init();

        // D: Suscribir el router de vistas
        PubSub.subscribe('NAVIGATE', (viewName) => {
            console.log(`[Kitchen] Navegando a: ${viewName}`);
            const routeAction = Routes[viewName];
            if (routeAction) {
                routeAction();
            } else {
                console.warn(`[Kitchen] Ruta desconocida: ${viewName}`);
            }
        });

        // E: Suscribir el manejador de modales
        //    El botón del KDS publica OPEN_MODAL('pin-modal').
        //    Aquí decidimos qué controlador maneja cada tipo.
        PubSub.subscribe('OPEN_MODAL', (modalId) => {
            if (modalId === 'pin-modal') {
                PinChecadorController.open();
            }
        });

        // F: Vista inicial
        setTimeout(() => {
            PubSub.publish('NAVIGATE', 'kds');
        }, 0);
    }
};

App.init();