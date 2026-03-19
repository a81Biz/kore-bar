// waiters/js/app.js
import { PubSub } from '/shared/js/pubsub.js';
import { viewManager } from '/shared/js/viewManager.js';

// Import View Modules
import { mount as mountLogin } from './views/login.js';
import { mount as mountDashboard } from './views/dashboard.js';
import { mount as mountOrder } from './views/order.js';

/**
 * Core Orchestrator for the Vanilla JS Waiters App.
 * Dictates SPA flow natively consuming the PubSub bus reacting upon isolated Lego View state transitions. 
 */
function initApp() {
    console.log("[App Engine] Initializing The Native Waiters Modules...");

    // Event Dictionary Registry
    PubSub.subscribe('AUTH_SUCCESS', (data) => {
        console.log(`[Event: AUTH_SUCCESS] Routing User ${data.employeeNumber} to Dashboard...`);
        const root = viewManager.mount('tpl-dashboard');
        mountDashboard(root, data);
    });

    PubSub.subscribe('TABLE_SELECTED', (data) => {
        console.log(`[Event: TABLE_SELECTED] Booting Cart POS Module for Table #${data.tableCode}`);
        const root = viewManager.mount('tpl-order');
        mountOrder(root, data); // Injecting external module constraints
    });

    PubSub.subscribe('ORDER_COMPLETED', () => {
        console.log("[Event: ORDER_COMPLETED] Bouncing back into Main Dashboard Flow...");
        const root = viewManager.mount('tpl-dashboard');
        mountDashboard(root);
    });

    PubSub.subscribe('LOGOUT_TRIGGERED', () => {
        console.log("[Event: LOGOUT_TRIGGERED] Terminating session context.");
        const root = viewManager.mount('tpl-login');
        mountLogin(root);
    });

    // Boot Default View
    const root = viewManager.mount('tpl-login');
    mountLogin(root);
}

// Bootstrap Initialization natively upon ES6 DOM load.
initApp();
