import { PubSub } from '/shared/js/pubsub.js';
import { fetchData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

// Razones de llamada en español
const CALL_REASONS = {
    ORDER: '📋 Quiere ordenar',
    BILL: '💳 Pide la cuenta',
    ASSISTANCE: '🙋 Necesita ayuda',
    CLEANING: '🧹 Limpieza'
};

export async function mount(container, authData) {
    const clockDisplay = container.querySelector('#clock-display');
    const btnLogout = container.querySelector('#btn-logout');
    const btnQuickOrder = container.querySelector('#btn-quick-order');
    const tablesGrid = container.querySelector('#tables-grid');
    const nameLabel = container.querySelector('.col-waiter-name');

    if (nameLabel && authData?.name) nameLabel.textContent = authData.name;

    // ── Estado local ──────────────────────────────────────────
    let pendingCalls = [];   // llamadas PENDING activas
    let pollTimer = null;

    // ── Reloj ─────────────────────────────────────────────────
    const updateTime = () => {
        if (clockDisplay) {
            clockDisplay.textContent = new Date().toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        }
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 60000);

    // ── Layout de mesas ───────────────────────────────────────
    const fetchTables = async () => {
        try {
            const res = await fetchData(ENDPOINTS.waiters.get.layout);
            if (res.success && res.data?.body?.layout.length > 0) {
                const allTables = res.data.body.layout.flatMap(zone => zone.tables);
                renderTables(allTables);
            }
        } catch (e) {
            console.error('[Dashboard] Error cargando layout de mesas:', e);
        }
    };

    // ── Llamadas pendientes ───────────────────────────────────
    const fetchCalls = async () => {
        try {
            // Endpoint: GET /api/public/waiters/calls
            const res = await fetchData(ENDPOINTS.waiters.get.calls);
            if (res.success) {
                pendingCalls = res.data?.body?.calls || res.data?.calls || [];
                renderCallsBanner();
            }
        } catch (e) {
            // Silencioso — el endpoint puede no existir aún
            console.warn('[Dashboard] Calls endpoint no disponible:', e.message);
        }
    };

    // ── Banner de llamadas pendientes ─────────────────────────
    const renderCallsBanner = () => {
        let banner = container.querySelector('#calls-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'calls-banner';
            banner.className = 'flex flex-col gap-2 px-6 py-3';
            // Insertar antes del grid de mesas
            const gridParent = tablesGrid?.parentElement;
            if (gridParent) gridParent.insertBefore(banner, tablesGrid);
        }

        banner.innerHTML = '';
        if (pendingCalls.length === 0) return;

        pendingCalls.forEach(call => {
            const reason = CALL_REASONS[call.reason] || call.reason;

            const card = document.createElement('div');
            card.className = 'flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 shadow-sm animate-pulse';

            const info = document.createElement('div');
            info.className = 'flex items-center gap-3';

            const icon = document.createElement('span');
            icon.className = 'text-2xl';
            icon.textContent = '🔔';

            const text = document.createElement('div');
            const title = document.createElement('span');
            title.className = 'font-bold text-amber-900 text-sm';
            title.textContent = `Mesa ${call.tableCode}`;
            const sub = document.createElement('span');
            sub.className = 'text-amber-700 text-xs block';
            sub.textContent = reason;
            text.appendChild(title);
            text.appendChild(sub);
            info.appendChild(icon);
            info.appendChild(text);

            const btnAttend = document.createElement('button');
            btnAttend.className = 'bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors';
            btnAttend.textContent = 'Atender';
            btnAttend.addEventListener('click', async () => {
                try {
                    await putData(ENDPOINTS.waiters.put.attendCall, {}, { callId: call.id });
                    card.remove();
                    pendingCalls = pendingCalls.filter(c => c.id !== call.id);
                } catch (e) {
                    console.error('[Dashboard] Error atendiendo llamada:', e);
                }
            });

            card.appendChild(info);
            card.appendChild(btnAttend);
            banner.appendChild(card);
        });
    };

    // ── Renderizar mesas ──────────────────────────────────────
    const renderTables = (tables) => {
        if (!tablesGrid) return;
        tablesGrid.innerHTML = '';

        tables.forEach(table => {
            const btn = document.createElement('button');
            const isOccupied = table.status === 'OCCUPIED';

            // Verificar si esta mesa tiene llamadas pendientes
            const tableCall = pendingCalls.find(c => c.tableCode === table.tableCode);

            btn.className = [
                'group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all shadow-sm aspect-square',
                isOccupied
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                    : tableCall
                        ? 'bg-amber-50 border-amber-400 animate-pulse'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary'
            ].join(' ');

            const iconWrap = document.createElement('div');
            iconWrap.className = [
                'size-20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform',
                isOccupied ? 'bg-green-500 shadow-md'
                    : tableCall ? 'bg-amber-400 shadow-md'
                        : 'bg-slate-100 dark:bg-slate-700'
            ].join(' ');

            const iconSpan = document.createElement('span');
            iconSpan.className = `material-symbols-outlined text-4xl ${isOccupied || tableCall ? 'text-white' : 'text-slate-400'}`;
            iconSpan.textContent = tableCall ? 'notifications_active' : isOccupied ? 'person' : 'event_seat';
            iconWrap.appendChild(iconSpan);

            const mesaLabel = document.createElement('span');
            mesaLabel.className = `text-2xl font-black mb-1 ${isOccupied ? 'text-green-700 dark:text-green-400' : tableCall ? 'text-amber-700' : 'text-slate-800 dark:text-white'}`;
            mesaLabel.textContent = `MESA ${table.tableCode}`;

            const statusLabel = document.createElement('span');
            statusLabel.className = `font-bold text-sm uppercase ${isOccupied ? 'text-green-600' : tableCall ? 'text-amber-600' : 'text-slate-400'}`;
            statusLabel.textContent = tableCall
                ? (CALL_REASONS[tableCall.reason] || 'Llamando')
                : isOccupied
                    ? (table.waiterName || `${table.capacity} Comensales`)
                    : 'Libre';

            if (isOccupied && table.waiterName) {
                const badge = document.createElement('div');
                badge.className = 'absolute top-4 right-4 text-white text-[10px] font-bold px-2 py-1 rounded-full bg-green-500';
                badge.textContent = table.waiterName;
                btn.appendChild(badge);
            }

            btn.appendChild(iconWrap);
            btn.appendChild(mesaLabel);
            btn.appendChild(statusLabel);

            btn.addEventListener('click', () => {
                cleanup();
                PubSub.publish('TABLE_SELECTED', {
                    tableCode: table.tableCode,
                    status: table.status,
                    waiterName: table.waiterName,
                    authData
                });
            });

            tablesGrid.appendChild(btn);
        });
    };

    // ── Polling fallback (30s, visibility-aware) ──────────────
    const refreshAll = async () => {
        await Promise.all([fetchTables(), fetchCalls()]);
    };

    const startPolling = () => {
        stopPolling();
        pollTimer = setInterval(() => {
            if (!document.hidden) refreshAll();
        }, 30000);
    };

    const stopPolling = () => {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    // Refresh inmediato cuando la pestaña vuelve a ser visible
    const onVisibility = () => {
        if (!document.hidden) refreshAll();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ── Escuchar llamadas vía Realtime (si está conectado) ────
    const onRealtimeCall = () => refreshAll();
    PubSub.subscribe('WAITER_CALL_RECEIVED', onRealtimeCall);

    // ── Cleanup ───────────────────────────────────────────────
    const cleanup = () => {
        clearInterval(clockInterval);
        stopPolling();
        document.removeEventListener('visibilitychange', onVisibility);
    };

    // ── Eventos ───────────────────────────────────────────────
    btnLogout?.addEventListener('click', () => {
        cleanup();
        PubSub.publish('LOGOUT_TRIGGERED');
    });

    btnQuickOrder?.addEventListener('click', () => {
        cleanup();
        PubSub.publish('TABLE_SELECTED', { tableCode: null, authData });
    });

    // ── Boot ──────────────────────────────────────────────────
    await refreshAll();
    startPolling();
}
