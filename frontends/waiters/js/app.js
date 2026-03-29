// waiters/js/app.js
import { PubSub }              from '/shared/js/pubsub.js';
import { viewManager }         from '/shared/js/viewManager.js';
import { KORE_CONFIG }         from '/core/js/kore.config.js';

// Import View Modules
import { mount as mountLogin }     from './views/login.js';
import { mount as mountDashboard } from './views/dashboard.js';
import { mount as mountOrder }     from './views/order.js';

// Módulo de Notificaciones Realtime (Área 4 — doc 10)
import { WaiterNotifications } from './realtime-notifications.js';

// Estado mínimo de sesión del mesero
const state = {
    session:       null,
    selectedTable: null
};

/**
 * Core Orchestrator for the Vanilla JS Waiters App.
 * Dictates SPA flow natively consuming the PubSub bus reacting upon isolated Lego View state transitions.
 */
function initApp() {
    console.log('[App Engine] Initializing The Native Waiters Modules...');

    // ── Autenticación exitosa ──────────────────────────────────────────────
    PubSub.subscribe('AUTH_SUCCESS', async (employee) => {
        state.session = employee;

        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.DASHBOARD);
        mountDashboard(root, state.session);

        // Conectar notificaciones Realtime — falla silenciosamente si Supabase
        // no está configurado (ver realtime-notifications.js)
        await WaiterNotifications.connect(employee.employeeNumber, (readyItem) => {
            console.log('[Waiter] Platillo listo recibido via Realtime:', readyItem);
        });
    });

    // ── Mesa seleccionada en el dashboard ─────────────────────────────────
    PubSub.subscribe('TABLE_SELECTED', (data) => {
        console.log(`[Event: TABLE_SELECTED] Booting Cart POS Module for Table #${data.tableCode}`);
        state.selectedTable = data.tableCode;

        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.ORDER);
        mountOrder(root, data);
    });

    // ── Orden completada → volver al dashboard ────────────────────────────
    PubSub.subscribe('ORDER_COMPLETED', () => {
        console.log('[Event: ORDER_COMPLETED] Bouncing back into Main Dashboard Flow...');
        state.selectedTable = null;

        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.DASHBOARD);
        mountDashboard(root, state.session);
    });

    // ── Logout ────────────────────────────────────────────────────────────
    PubSub.subscribe('LOGOUT_TRIGGERED', () => {
        // Desconectar notificaciones Realtime antes de limpiar sesión
        WaiterNotifications.disconnect();
        localStorage.removeItem('pos_token');

        state.session       = null;
        state.selectedTable = null;

        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.LOGIN);
        mountLogin(root);
    });

    // Boot Default View
    const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.LOGIN);
    mountLogin(root);
}

initApp();