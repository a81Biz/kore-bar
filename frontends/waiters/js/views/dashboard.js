// frontends/waiters/js/views/dashboard.js
import { PubSub } from '/shared/js/pubsub.js';
import { fetchData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

const CALL_REASONS = {
    ORDER: '📋 Quiere ordenar',
    BILL: '💳 Pide la cuenta',
    ASSISTANCE: '🙋 Necesita ayuda',
    CLEANING: '🧹 Limpieza'
};

export async function mount(container, authData) {
    const clockDisplay = container.querySelector('#clock-display');
    const btnLogout = container.querySelector('#btn-logout');
    const tablesGrid = container.querySelector('#tables-grid');

    const nameLabel = container.querySelector('.col-waiter-name');
    const numberLabel = container.querySelector('.col-waiter-number');
    const shiftLabel = container.querySelector('.col-waiter-shift');
    const zoneLabel = container.querySelector('.col-waiter-zone');

    if (nameLabel && authData?.name) nameLabel.textContent = authData.name;
    if (numberLabel && authData?.employeeNumber) numberLabel.textContent = `#${authData.employeeNumber}`;
    if (shiftLabel && authData?.shift) shiftLabel.textContent = authData.shift;
    if (zoneLabel && authData?.zona) zoneLabel.textContent = authData.zona;

    let pendingCalls = [];
    let pollTableTimer = null;  // mesas: 30s
    let pollCallsTimer = null;  // llamadas: 8s
    let _callSub = null;

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
            if (res.success && res.data?.body?.layout?.length > 0) {
                const waiterZone = authData?.zona;
                const filteredZone = res.data.body.layout.find(z => z.zoneName === waiterZone);
                const allTables = filteredZone ? filteredZone.tables : [];
                renderTables(allTables);
            }
        } catch (e) {
            console.error('[Dashboard] Error cargando layout de mesas:', e);
        }
    };

    // ── Llamadas pendientes ───────────────────────────────────
    const fetchCalls = async () => {
        try {
            const res = await fetchData(ENDPOINTS.waiters.get.calls);
            if (res.success) {
                pendingCalls = res.data?.body?.calls || res.data?.calls || [];
                renderCallsBanner();
                await fetchTables(); // re-render mesas con indicador de llamada
            }
        } catch (e) {
            console.warn('[Dashboard] Calls endpoint no disponible:', e.message);
        }
    };

    // ── Banner de llamadas ────────────────────────────────────
    const renderCallsBanner = () => {
        let banner = container.querySelector('#calls-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'calls-banner';
            banner.className = 'flex flex-col gap-2 px-6 py-3';
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
                    await fetchTables();
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
            const isAwaitingPayment = table.status === 'AWAITING_PAYMENT';
            const tableCall = pendingCalls.find(c => c.tableCode === table.tableCode);

            btn.className = [
                'group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all shadow-sm aspect-square',
                isOccupied ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                    : isAwaitingPayment ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400'
                        : tableCall ? 'bg-amber-50 border-amber-400 animate-pulse'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary'
            ].join(' ');

            const iconWrap = document.createElement('div');
            iconWrap.className = [
                'size-20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform',
                isOccupied ? 'bg-green-500 shadow-md'
                    : isAwaitingPayment ? 'bg-blue-400 shadow-md'
                        : tableCall ? 'bg-amber-400 shadow-md'
                            : 'bg-slate-100 dark:bg-slate-700'
            ].join(' ');

            const iconSpan = document.createElement('span');
            iconSpan.className = `material-symbols-outlined text-4xl ${isOccupied || isAwaitingPayment || tableCall ? 'text-white' : 'text-slate-400'
                }`;
            iconSpan.textContent = tableCall ? 'notifications_active'
                : isOccupied ? 'person'
                    : isAwaitingPayment ? 'payments'
                        : 'event_seat';
            iconWrap.appendChild(iconSpan);

            const mesaLabel = document.createElement('span');
            mesaLabel.className = `text-2xl font-black mb-1 ${isOccupied ? 'text-green-700 dark:text-green-400'
                    : isAwaitingPayment ? 'text-blue-600 dark:text-blue-400'
                        : tableCall ? 'text-amber-700'
                            : 'text-slate-800 dark:text-white'
                }`;
            mesaLabel.textContent = `MESA ${table.tableCode}`;

            const statusLabel = document.createElement('span');
            statusLabel.className = `font-bold text-sm uppercase ${isOccupied ? 'text-green-600'
                    : isAwaitingPayment ? 'text-blue-500'
                        : tableCall ? 'text-amber-600'
                            : 'text-slate-400'
                }`;
            statusLabel.textContent = tableCall ? (CALL_REASONS[tableCall.reason] || 'Llamando')
                : isOccupied ? (table.waiterName || `${table.capacity} Comensales`)
                    : isAwaitingPayment ? '💳 Esperando Cuenta'
                        : 'Libre';

            if ((isOccupied || isAwaitingPayment) && table.waiterName) {
                const badge = document.createElement('div');
                badge.className = `absolute top-4 right-4 text-white text-[10px] font-bold px-2 py-1 rounded-full ${isOccupied ? 'bg-green-500' : 'bg-blue-400'
                    }`;
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

    // ── Polling doble — FIX: 30s mesas / 8s llamadas ─────────
    const startPolling = () => {
        stopPolling();
        pollTableTimer = setInterval(() => { if (!document.hidden) fetchTables(); }, 30000);
        pollCallsTimer = setInterval(() => { if (!document.hidden) fetchCalls(); }, 8000);
    };

    const stopPolling = () => {
        if (pollTableTimer) { clearInterval(pollTableTimer); pollTableTimer = null; }
        if (pollCallsTimer) { clearInterval(pollCallsTimer); pollCallsTimer = null; }
    };

    const onVisibility = () => {
        if (!document.hidden) { fetchTables(); fetchCalls(); }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // FIX: Guardar token de suscripción para limpiarlo en cleanup
    const onRealtimeCall = () => fetchCalls();
    _callSub = PubSub.subscribe('WAITER_CALL_RECEIVED', onRealtimeCall);

    // ── Cleanup ───────────────────────────────────────────────
    const cleanup = () => {
        clearInterval(clockInterval);
        stopPolling();
        document.removeEventListener('visibilitychange', onVisibility);
        // FIX: Cancelar suscripción PubSub — evita listeners zombie
        if (typeof _callSub === 'function') _callSub();
        else PubSub.unsubscribe?.('WAITER_CALL_RECEIVED', onRealtimeCall);
    };

    btnLogout?.addEventListener('click', () => {
        cleanup();
        PubSub.publish('LOGOUT_TRIGGERED');
    });

    // ── Boot ──────────────────────────────────────────────────
    await fetchTables();
    await fetchCalls();
    startPolling();
}