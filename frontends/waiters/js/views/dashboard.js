// waiters/js/views/dashboard.js
import { PubSub } from '/shared/js/pubsub.js';
import { fetchData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

export async function mount(container, authData) {
    const clockDisplay = container.querySelector('#clock-display');
    const btnLogout = container.querySelector('#btn-logout');
    const btnQuickOrder = container.querySelector('#btn-quick-order');
    const tablesGrid = container.querySelector('#tables-grid');

    // ✅ Nombre del mesero inyectado con textContent — datos de auth, no de API directa
    const nameLabel = container.querySelector('.col-waiter-name');
    if (nameLabel && authData?.name) nameLabel.textContent = authData.name;

    // ── Reloj ─────────────────────────────────────────────────────────────
    const updateTime = () => {
        if (clockDisplay) {
            clockDisplay.textContent = new Date().toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);

    // ── Layout de mesas ───────────────────────────────────────────────────
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

    const renderTables = (tables) => {
        if (!tablesGrid) return;
        tablesGrid.innerHTML = '';

        tables.forEach(table => {
            const btn = document.createElement('button');
            const isOccupied = table.status === 'OCCUPIED';

            // Clases por estado — sin datos de la API en className
            btn.className = [
                'group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all shadow-sm aspect-square',
                isOccupied
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary'
            ].join(' ');

            // Icono
            const iconWrap = document.createElement('div');
            iconWrap.className = [
                'size-20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform',
                isOccupied ? 'bg-green-500 shadow-md' : 'bg-slate-100 dark:bg-slate-700'
            ].join(' ');

            const iconSpan = document.createElement('span');
            iconSpan.className = `material-symbols-outlined text-4xl ${isOccupied ? 'text-white' : 'text-slate-400'}`;
            iconSpan.textContent = isOccupied ? 'person' : 'event_seat';
            iconWrap.appendChild(iconSpan);

            // Nombre de mesa
            const mesaLabel = document.createElement('span');
            mesaLabel.className = `text-2xl font-black mb-1 ${isOccupied ? 'text-green-700 dark:text-green-400' : 'text-slate-800 dark:text-white'}`;
            // ✅ tableCode con textContent
            mesaLabel.textContent = `MESA ${table.tableCode}`;

            // Sublabel de estado
            const statusLabel = document.createElement('span');
            statusLabel.className = `font-bold text-sm uppercase ${isOccupied ? 'text-green-600 dark:text-green-500' : 'text-slate-400'}`;
            // ✅ waiterName con textContent
            statusLabel.textContent = isOccupied
                ? (table.waiterName ? table.waiterName : `${table.capacity} Comensales`)
                : 'Libre';

            // Badge del mesero (mesa ocupada) — ✅ textContent, sin innerHTML
            if (isOccupied && table.waiterName) {
                const badge = document.createElement('div');
                badge.className = 'absolute top-4 right-4 text-white text-[10px] font-bold px-2 py-1 rounded-full bg-green-500';
                badge.textContent = table.waiterName; // ✅
                btn.appendChild(badge);
            }

            btn.appendChild(iconWrap);
            btn.appendChild(mesaLabel);
            btn.appendChild(statusLabel);

            btn.addEventListener('click', () => {
                clearInterval(interval);
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

    fetchTables();

    // ── Eventos ───────────────────────────────────────────────────────────
    btnLogout?.addEventListener('click', () => {
        clearInterval(interval);
        PubSub.publish('LOGOUT_TRIGGERED');
    });

    btnQuickOrder?.addEventListener('click', () => {
        clearInterval(interval);
        PubSub.publish('TABLE_SELECTED', { tableCode: null, authData });
    });
}