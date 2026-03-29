// frontends/waiters/js/app.js — REEMPLAZAR completo:

import { PubSub } from '/shared/js/pubsub.js';
import { viewManager } from '/shared/js/viewManager.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';
import { fetchData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

import { mount as mountLogin } from './views/login.js';
import { mount as mountDashboard } from './views/dashboard.js';
import { mount as mountOrder } from './views/order.js';
import { WaiterNotifications } from './realtime-notifications.js';

const state = {
    session: null,
    selectedTable: null
};

// ── Polling global de llamadas ────────────────────────────────────────────
// FIX: El polling de llamadas solo existía en el dashboard. Cuando el mesero
// estaba en el order view, no llegaban notificaciones de clientes.
// Este timer corre siempre — independientemente de la vista activa.
let _globalCallsTimer = null;

const CALL_REASONS = {
    ORDER: '📋 Quiere ordenar',
    BILL: '💳 Pide la cuenta',
    ASSISTANCE: '🙋 Necesita ayuda',
    CLEANING: '🧹 Limpieza'
};

const _showGlobalToast = (message, color = '#d97706') => {
    let container = document.getElementById('waiter-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'waiter-toast-container';
        container.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.style.cssText = `background:${color};color:#fff;padding:0.75rem 1.25rem;border-radius:0.75rem;font-size:0.875rem;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.2);display:flex;align-items:center;gap:0.5rem;`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 7000);
};

// Guarda los IDs ya notificados para no repetir
const _notifiedCallIds = new Set();

const _pollGlobalCalls = async () => {
    if (!state.session) return;
    try {
        const res = await fetchData(ENDPOINTS.waiters.get.calls);
        const calls = res.data?.body?.calls || res.data?.calls || [];
        calls.forEach(call => {
            if (_notifiedCallIds.has(call.id)) return;
            _notifiedCallIds.add(call.id);
            const reason = CALL_REASONS[call.reason] || call.reason;
            _showGlobalToast(`<span>🔔</span><span><strong>Mesa ${call.tableCode}:</strong> ${reason}</span>`);
            PubSub.publish('WAITER_CALL_RECEIVED', call);
        });
    } catch { /* silencioso — endpoint puede no estar disponible */ }
};

const startGlobalPolling = () => {
    stopGlobalPolling();
    _globalCallsTimer = setInterval(() => {
        if (!document.hidden) _pollGlobalCalls();
    }, 8000);
};

const stopGlobalPolling = () => {
    if (_globalCallsTimer) { clearInterval(_globalCallsTimer); _globalCallsTimer = null; }
};

function initApp() {
    PubSub.subscribe('AUTH_SUCCESS', async (employee) => {
        state.session = employee;
        _notifiedCallIds.clear();

        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.DASHBOARD);
        mountDashboard(root, state.session);

        await WaiterNotifications.connect(employee.employeeNumber, () => { });
        startGlobalPolling();  // ← inicia polling global tras login
    });

    PubSub.subscribe('TABLE_SELECTED', (data) => {
        state.selectedTable = data.tableCode;
        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.ORDER);
        mountOrder(root, data);
        // El polling global sigue corriendo en background ✓
    });

    PubSub.subscribe('ORDER_COMPLETED', () => {
        state.selectedTable = null;
        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.DASHBOARD);
        mountDashboard(root, state.session);
    });

    PubSub.subscribe('LOGOUT_TRIGGERED', () => {
        WaiterNotifications.disconnect();
        stopGlobalPolling();
        _notifiedCallIds.clear();
        localStorage.removeItem('pos_token');
        state.session = null;
        state.selectedTable = null;
        const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.LOGIN);
        mountLogin(root);
    });

    const root = viewManager.mount(KORE_CONFIG.DOM.WAITERS.TEMPLATES.LOGIN);
    mountLogin(root);
}

initApp();