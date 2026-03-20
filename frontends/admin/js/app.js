// frontends/admin/js/app.js
import { PubSub } from '/shared/js/pubsub.js';
import { viewManager } from '/shared/js/viewManager.js';
import { TemplateLoader } from '/shared/js/templateLoader.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';

// Controladores de Vistas
import { mount as mountSidebar } from './views/sidebar.js';
import { mount as mountDashboard } from './views/dashboard.js';
import { mount as mountEmpleados } from './views/empleados.js';
import { PisoController } from './views/piso/index.js';
import { MenuController } from './views/menu/index.js';
import { InventarioController } from './views/inventario/index.js';
import { TurnosController } from './views/turnos/index.js';

// 1. DICCIONARIO DE RUTAS (Objeto Literal)
const Routes = {
    'dashboard': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.DASHBOARD);
        mountDashboard(root);
    },
    'piso': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.PISO);
        PisoController.mount(root);
    },
    'empleados': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.EMPLEADOS);
        mountEmpleados(root);
    },
    'menu': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.MENU);
        MenuController.mount(root);
    },
    'inventario': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.INVENTARIO);
        InventarioController.mount(root);
    },
    'turnos': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.TURNOS);
        TurnosController.mount(root);
    }
};

// 2. ORQUESTADOR
const App = {
    async init() {
        console.log('[Admin] Iniciando secuencia de arranque de la SPA...');

        await TemplateLoader.loadPartials(KORE_CONFIG.DOM.ADMIN.PARTIALS, '');

        const sidebarContainer = document.querySelector(KORE_CONFIG.DOM.ADMIN.CONTAINERS.SIDEBAR);
        const sidebarTemplate = document.getElementById(KORE_CONFIG.DOM.ADMIN.TEMPLATES.SIDEBAR);

        if (sidebarContainer && sidebarTemplate) {
            sidebarContainer.appendChild(sidebarTemplate.content.cloneNode(true));
            mountSidebar(sidebarContainer);
        }

        PubSub.subscribe('NAVIGATE', (viewName) => {
            console.log(`[Admin] Navegando a: ${viewName}`);
            const routeAction = Routes[viewName];
            if (routeAction) {
                routeAction();
            } else {
                console.warn(`[Admin] Ruta desconocida: ${viewName}`);
                viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.WIP);
            }
        });

        setTimeout(() => {
            PubSub.publish('NAVIGATE', 'dashboard');
        }, 0);
    }
};

App.init();