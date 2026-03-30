// ============================================================
// waiters/js/realtime-notifications.js
// Módulo: Notificaciones Realtime para Mesero (Supabase)
//
// Dos canales:
//   1. order_items UPDATE → status=READY  (platillo listo)
//   2. waiter_calls INSERT               (cliente llama)
//
// Fallback: Si Supabase no está configurado, el dashboard
// hace polling cada 30s (ver dashboard.js).
// ============================================================

import { PubSub } from '/shared/js/pubsub.js';
import { waitForEnv } from '/core/js/kore.env.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const _state = {
    channelItems: null,
    channelCalls: null,
    client: null,
    isConnected: false,
    pollingInterval: null
};

// ── Toast de notificación ─────────────────────────────────────
const _ensureToastContainer = () => {
    let container = document.getElementById('waiter-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'waiter-toast-container';
        container.style.cssText = [
            'position:fixed', 'top:1rem', 'right:1rem', 'z-index:9999',
            'display:flex', 'flex-direction:column', 'gap:0.5rem'
        ].join(';');
        document.body.appendChild(container);
    }
    return container;
};

const _showToast = (message, color = '#059669') => {
    const container = _ensureToastContainer();
    const toast = document.createElement('div');
    toast.style.cssText = [
        `background:${color}`, 'color:#fff', 'padding:0.75rem 1.25rem',
        'border-radius:0.75rem', 'font-size:0.875rem', 'font-weight:600',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)', 'display:flex',
        'align-items:center', 'gap:0.5rem',
        'animation:slideInRight 0.3s ease-out'
    ].join(';');
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
};

// ── Razones de llamada en español ─────────────────────────────
const CALL_REASONS = {
    ORDER: '📋 Quiere ordenar',
    BILL: '💳 Pide la cuenta',
    ASSISTANCE: '🙋 Necesita ayuda',
    CLEANING: '🧹 Limpieza'
};

// ── Lógica de conexión ────────────────────────────────────────
const _logic = {
    connect: async (employeeNumber, onReady) => {
        if (_state.isConnected) return;

        try {
            const { SUPABASE_URL, SUPABASE_ANON_KEY } = await waitForEnv();
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new Error("Variables de Supabase no definidas en KORE_ENV");
            }
            _state.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // ── Canal 1: Platillos listos (READY) ─────────────
            _state.channelItems = _state.client
                .channel(`waiter-ready-${employeeNumber}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'order_items', filter: 'status=eq.READY' },
                    (payload) => {
                        const readyItem = payload.new;
                        const itemName = readyItem.dish_name || readyItem.name || 'Platillo';
                        _showToast(`<span>✅</span><span>Listo para servir: <strong>${itemName}</strong></span>`);
                        PubSub.publish('ITEM_READY_NOTIFIED', readyItem);
                        if (typeof onReady === 'function') onReady(readyItem);
                    }
                )
                .subscribe();

            // ── Canal 2: Llamadas de cliente (INSERT) ─────────
            _state.channelCalls = _state.client
                .channel(`waiter-calls-${employeeNumber}`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'waiter_calls' },
                    (payload) => {
                        const call = payload.new;
                        const reason = CALL_REASONS[call.reason] || call.reason;
                        _showToast(
                            `<span>🔔</span><span><strong>Mesa solicita atención:</strong> ${reason}</span>`,
                            '#d97706'  // amber
                        );
                        PubSub.publish('WAITER_CALL_RECEIVED', call);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        _state.isConnected = true;
                        console.log(`[WaiterNotifications] Conectado a Realtime (${employeeNumber}).`);
                    }
                });

        } catch (err) {
            console.warn('[WaiterNotifications] Supabase no disponible — usando polling fallback:', err.message);
            // Fallback: igual que en cocina, polling cada N segundos
            if (!_state.pollingInterval) {
                _state.pollingInterval = setInterval(() => {
                    // Nota: El dashboard ya hace polling de tables(30s) y calls(8s).
                    // Aquí se simula la estructura para acoplarse si existiese endpoint de platillos.
                }, 5000);
            }
        }
    },

    disconnect: () => {
        if (_state.client) {
            if (_state.channelItems) _state.client.removeChannel(_state.channelItems);
            if (_state.channelCalls) _state.client.removeChannel(_state.channelCalls);
            _state.channelItems = null;
            _state.channelCalls = null;
            _state.isConnected = false;
            console.log('[WaiterNotifications] Canales Realtime desconectados.');
        }
        if (_state.pollingInterval) {
            clearInterval(_state.pollingInterval);
            _state.pollingInterval = null;
        }
    }
};

export const WaiterNotifications = {
    connect: (employeeNumber, onReady) => _logic.connect(employeeNumber, onReady),
    disconnect: () => _logic.disconnect(),
    get isConnected() { return _state.isConnected; }
};
