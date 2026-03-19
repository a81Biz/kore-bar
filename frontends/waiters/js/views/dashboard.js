// waiters/js/views/dashboard.js
import { PubSub } from '/shared/js/pubsub.js';

export async function mount(container, authData) {
    // Top UI bindings
    const clockDisplay = container.querySelector('#clock-display');
    const btnLogout = container.querySelector('#btn-logout');
    const btnQuickOrder = container.querySelector('#btn-quick-order');
    const tablesGrid = container.querySelector('#tables-grid');

    // Inject authData name if present
    const nameLabel = container.querySelector('.text-right p.font-bold');
    if (nameLabel && authData && authData.name) {
        nameLabel.textContent = authData.name;
    }

    const { ENDPOINTS } = await import('/shared/js/endpoints.js');
    const { fetchData } = await import('/shared/js/http.client.js');

    // 1. Clock Tracker
    const updateTime = () => {
        const time = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
        if (clockDisplay) clockDisplay.textContent = time;
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);

    // 2. Fetch Active Tables from SSOT endpoint
    const fetchTables = async () => {
        try {
            const res = await fetchData(ENDPOINTS.waiters.get.layout);
            if (res.success && res.data && res.data.length > 0) {
                // The layout backend returns grouped by Zone. We flatten it here for 'Todas' view.
                let allTables = [];
                res.data.forEach(zone => {
                    zone.tables.forEach(t => {
                        allTables.push(t);
                    });
                });
                renderTables(allTables);
            }
        } catch (e) {
            console.error("Failed loading table layout:", e);
        }
    };

    const renderTables = (tables) => {
        if (!tablesGrid) return;
        tablesGrid.innerHTML = '';

        tables.forEach(table => {
            const btn = document.createElement('button');

            // Logical Tailwind formatting dynamically rendered based upon state rules
            let bgClass = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary";
            let iconClass = "text-slate-400";
            let iconCode = "event_seat";
            let iconBgClass = "bg-slate-100 dark:bg-slate-700";
            let textClass = "text-slate-800 dark:text-white";
            let upperClass = "text-slate-400";
            let upperRaw = "Libre";
            let labelBadge = "";

            if (table.status === 'OCCUPIED') {
                bgClass = "bg-green-50 dark:bg-green-900/20 border-green-500";
                iconClass = "text-white";
                iconCode = "person";
                iconBgClass = "bg-green-500 shadow-md";
                textClass = "text-green-700 dark:text-green-400";
                upperClass = "text-green-600 dark:text-green-500";
                upperRaw = `${table.capacity} Comensales`;
                labelBadge = table.waiterName ? `<div class="absolute top-4 right-4 text-white text-[10px] font-bold px-2 py-1 rounded-full bg-green-500">${table.waiterName}</div>` : '';
            }

            btn.className = `group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all shadow-sm aspect-square ${bgClass}`;
            btn.innerHTML = `
                ${labelBadge}
                <div class="size-20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${iconBgClass}">
                    <span class="material-symbols-outlined text-4xl ${iconClass}">${iconCode}</span>
                </div>
                <span class="text-2xl font-black mb-1 ${textClass}">MESA ${table.tableCode}</span>
                <span class="font-bold text-sm uppercase ${upperClass}">${upperRaw}</span>
            `;

            // Emit Order Transition natively parsing logic
            btn.addEventListener('click', () => {
                clearInterval(interval);
                PubSub.publish('TABLE_SELECTED', {
                    tableCode: table.tableCode,
                    status: table.status,
                    waiterName: table.waiterName,
                    authData: authData // Pass auth to next view!
                });
            });

            tablesGrid.appendChild(btn);
        });
    };

    fetchTables();

    // Event Bindings
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            clearInterval(interval);
            PubSub.publish('LOGOUT_TRIGGERED');
        });
    }

    if (btnQuickOrder) {
        btnQuickOrder.addEventListener('click', () => {
            clearInterval(interval);
            PubSub.publish('TABLE_SELECTED', { tableId: 0 }); // Null pattern table
        });
    }
}
