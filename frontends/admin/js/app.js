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
    'turnos': () => {
        viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.WIP);
    },
    'inventario': () => {
        const root = viewManager.mount(KORE_CONFIG.DOM.ADMIN.TEMPLATES.INVENTARIO);
        InventarioController.mount(root);
    },
};

// 2. ORQUESTADOR
const App = {
    async init() {
        console.log('[Admin] Iniciando secuencia de arranque de la SPA...');

        // PASO A: Pre-cargar todos los templates HTML basándose en el modelo global
        await TemplateLoader.loadPartials(KORE_CONFIG.DOM.ADMIN.PARTIALS, '');

        // PASO B: Montar el Sidebar estático
        const sidebarContainer = document.querySelector(KORE_CONFIG.DOM.ADMIN.CONTAINERS.SIDEBAR);
        const sidebarTemplate = document.getElementById(KORE_CONFIG.DOM.ADMIN.TEMPLATES.SIDEBAR);

        if (sidebarContainer && sidebarTemplate) {
            sidebarContainer.appendChild(sidebarTemplate.content.cloneNode(true));
            mountSidebar(sidebarContainer);
        }

        // PASO C: Suscribir el Enrutador
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

        // PASO D: Lanzar la vista inicial
        setTimeout(() => {
            PubSub.publish('NAVIGATE', 'dashboard');
        }, 0);
    }
};

// Como esto es inyectado por el Core, el DOM ya está listo.
App.init();