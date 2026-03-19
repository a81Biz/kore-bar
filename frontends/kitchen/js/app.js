// frontends/kitchen/js/app.js
import { PubSub } from '/shared/js/pubsub.js';
import { viewManager } from '/shared/js/viewManager.js';
import { TemplateLoader } from '/shared/js/templateLoader.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';

// Controladores de Vistas (Los crearemos en el siguiente paso)
import { KdsController } from './views/kds/index.js';
import { RecetasController } from './views/recetas/index.js';
import { InventarioController } from './views/inventario/index.js';

// 1. DICCIONARIO DE RUTAS (Objeto Literal)
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

// 2. ORQUESTADOR
const App = {
    async init() {
        console.log('[Kitchen] Iniciando secuencia de arranque de la SPA...');

        // PASO A: Pre-cargar todos los templates HTML basándose en el modelo global
        await TemplateLoader.loadPartials(KORE_CONFIG.DOM.KITCHEN.PARTIALS, '');

        // PASO B: Montar la Modal del PIN globalmente
        const modalContainer = document.getElementById('modal-container');
        const modalTemplate = document.getElementById(KORE_CONFIG.DOM.KITCHEN.TEMPLATES.MODAL_PIN);

        if (modalContainer && modalTemplate) {
            modalContainer.appendChild(modalTemplate.content.cloneNode(true));
        }

        // PASO C: Suscribir el Enrutador
        PubSub.subscribe('NAVIGATE', (viewName) => {
            console.log(`[Kitchen] Navegando a: ${viewName}`);

            const routeAction = Routes[viewName];
            if (routeAction) {
                routeAction();
            } else {
                console.warn(`[Kitchen] Ruta desconocida: ${viewName}`);
            }
        });

        // PASO D: Lanzar la vista inicial (El KDS Táctil)
        setTimeout(() => {
            PubSub.publish('NAVIGATE', 'kds');
        }, 0);
    }
};

// Como esto es inyectado por el Core, el DOM ya está listo.
App.init();