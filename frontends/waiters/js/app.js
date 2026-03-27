// waiters/js/app.js
import { PubSub } from '/shared/js/pubsub.js';
import { viewManager } from '/shared/js/viewManager.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';

// Import View Modules
import { mount as mountLogin } from './views/login.js';
import { mount as mountDashboard } from './views/dashboard.js';
import { mount as mountOrder } from './views/order.js';

import { WaiterNotifications } from './realtime-notifications.js';

/**
 * Core Orchestrator for the Vanilla JS Waiters App.
 * Dictates SPA flow natively consuming the PubSub bus reacting upon isolated Lego View state transitions.
 */
function initApp() {
    console.log("[App Engine] Initializing The Native Waiters Modules...");

    PubSub.subscribe('AUTH_SUCCESS', async (employee) => {
        state.session = employee;
        viewManager.mount('tpl-dashboard');

        // ─── NUEVO: Conectar notificaciones Realtime ─────────
        await WaiterNotifications.connect(employee.employeeNumber, (readyItem) => {
            // Callback: cuando un platillo pasa a READY, refrescar la vista si está en dashboard
            // El toast y sonido ya se manejan internamente en el módulo
            console.log('[Waiter] Platillo listo:', readyItem);
        });
    });

    PubSub.subscribe('TABLE_SELECTED', (data) => {
        console.log(`[Event: TABLE_SELECTED] Booting Cart POS Module for Table #${data.tableCode}`);
        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.ORDER);
        mountOrder(root, data);
    });

    PubSub.subscribe('ORDER_COMPLETED', () => {
        console.log("[Event: ORDER_COMPLETED] Bouncing back into Main Dashboard Flow...");
        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.DASHBOARD);
        mountDashboard(root);
    });

    PubSub.subscribe('LOGOUT_TRIGGERED', () => {
        // ─── NUEVO: Desconectar notificaciones Realtime ──────
        WaiterNotifications.disconnect();

        state.session = null;
        state.selectedTable = null;
        viewManager.mount('tpl-login');
    });




    // Boot Default View
    const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.LOGIN);
    mountLogin(root);
}

initApp();