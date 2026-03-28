// ============================================================
// waiters/js/realtime-notifications.js
// Módulo: Notificaciones Realtime para Mesero (Supabase)
// Patrón: Módulo de 7 secciones
// Área 4 — doc 10_guia_integracion_mejoras.md
//
// Escucha cambios en order_items a través del canal Realtime
// de Supabase. Cuando un item pasa a READY, publica el evento
// PubSub 'ITEM_READY_NOTIFIED' y ejecuta el callback opcional.
// ============================================================

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { PubSub } from '/shared/js/pubsub.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';

// ==========================================================================
// 2. ESTADO PRIVADO Y CONFIGURACIÓN
// ==========================================================================
const _state = {
    channel: null,
    client:  null,
    isConnected: false
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
// Este módulo no interactúa con el DOM directamente.

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO — Toast de notificación
// ==========================================================================
const _showReadyToast = (itemName) => {
    // Crear toast si no existe un contenedor
    let toastContainer = document.getElementById('waiter-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'waiter-toast-container';
        toastContainer.style.cssText = [
            'position:fixed',
            'top:1rem',
            'right:1rem',
            'z-index:9999',
            'display:flex',
            'flex-direction:column',
            'gap:0.5rem'
        ].join(';');
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.style.cssText = [
        'background:#059669',
        'color:#fff',
        'padding:0.75rem 1.25rem',
        'border-radius:0.75rem',
        'font-size:0.875rem',
        'font-weight:600',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
        'display:flex',
        'align-items:center',
        'gap:0.5rem',
        'animation:slideInRight 0.3s ease-out'
    ].join(';');
    toast.innerHTML = `<span>✅</span><span>Listo para servir: <strong>${itemName}</strong></span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS
// ==========================================================================
const _logic = {

    /**
     * Crea el cliente Supabase y suscribe al canal realtime de order_items.
     * Falla silenciosamente si Supabase no está configurado.
     * @param {string} employeeNumber — Número del mesero autenticado
     * @param {Function} onReady — Callback opcional (readyItem) => void
     */
    connect: async (employeeNumber, onReady) => {
        const supabaseUrl  = window.KORE_ENV?.SUPABASE_URL;
        const supabaseKey  = window.KORE_ENV?.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.warn('[WaiterNotifications] Supabase no configurado — Realtime deshabilitado.');
            return;
        }

        if (_state.isConnected) {
            console.warn('[WaiterNotifications] Ya hay una conexión activa.');
            return;
        }

        try {
            // Importar el cliente de Supabase en tiempo de ejecución para no romper
            // entornos sin CDN de Supabase.
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            _state.client = createClient(supabaseUrl, supabaseKey);

            _state.channel = _state.client
                .channel(`waiter-ready-${employeeNumber}`)
                .on(
                    'postgres_changes',
                    {
                        event:  'UPDATE',
                        schema: 'public',
                        table:  'order_items',
                        filter: `status=eq.READY`
                    },
                    (payload) => {
                        const readyItem = payload.new;
                        console.log('[WaiterNotifications] Item READY recibido:', readyItem);

                        // Mostrar notificación visual
                        const itemName = readyItem.dish_name || readyItem.name || 'Platillo';
                        _showReadyToast(itemName);

                        // Publicar en el bus de eventos para que app.js (u otros módulos) reaccionen
                        PubSub.publish('ITEM_READY_NOTIFIED', readyItem);

                        // Ejecutar callback opcional del caller
                        if (typeof onReady === 'function') {
                            onReady(readyItem);
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        _state.isConnected = true;
                        console.log(`[WaiterNotifications] Conectado al canal Realtime (${employeeNumber}).`);
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('[WaiterNotifications] Error en el canal Realtime.');
                        _state.isConnected = false;
                    }
                });

        } catch (err) {
            console.warn('[WaiterNotifications] Error al conectar Realtime:', err.message);
        }
    },

    /**
     * Desconecta el canal Supabase Realtime.
     */
    disconnect: () => {
        if (_state.channel && _state.client) {
            _state.client.removeChannel(_state.channel);
            _state.channel    = null;
            _state.isConnected = false;
            console.log('[WaiterNotifications] Canal Realtime desconectado.');
        }
    }
};

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
// Los eventos de conexión/desconexión los gestiona app.js via PubSub.

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const WaiterNotifications = {
    /**
     * Conecta el canal Realtime de Supabase.
     * @param {string} employeeNumber
     * @param {Function} [onReady] — Callback adicional cuando un item pasa a READY
     */
    connect: (employeeNumber, onReady) => _logic.connect(employeeNumber, onReady),

    /**
     * Desconecta el canal Realtime.
     */
    disconnect: () => _logic.disconnect(),

    /**
     * Indica si hay una conexión activa.
     */
    get isConnected() { return _state.isConnected; }
};
