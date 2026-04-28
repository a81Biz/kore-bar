// ============================================================
// views/reportes/view.js
// Secciones 3 y 4: Caché del DOM + Lógica de Vista / Renderizado
// ============================================================
import { state, uiConfig } from './state.js';

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
export const cacheDOM = (container) => {
    state.dom.startDate       = container.querySelector('#report-start-date');
    state.dom.endDate         = container.querySelector('#report-end-date');
    state.dom.btnFilter       = container.querySelector('#btn-report-filter');
    state.dom.btnExport       = container.querySelector('#btn-report-export');
    state.dom.tabs            = container.querySelector('#report-tabs');
    state.dom.tableHead       = container.querySelector('#report-table-head');
    state.dom.tableBody       = container.querySelector('#report-table-body');
    state.dom.chartContainer  = container.querySelector('#report-chart-container');
    state.dom.chartCanvas     = container.querySelector('#report-chart');
    state.dom.emptyState      = container.querySelector('#report-empty');
    state.dom.kpiTickets      = container.querySelector('#kpi-tickets');
    state.dom.kpiRevenue      = container.querySelector('#kpi-revenue');
    state.dom.kpiAvgTicket    = container.querySelector('#kpi-avg-ticket');
    state.dom.kpiTips         = container.querySelector('#kpi-tips');

    // Defaults: últimos 3 meses
    const today     = new Date();
    const rangeStart = new Date(today);
    rangeStart.setMonth(rangeStart.getMonth() - 3);

    state.dom.startDate.value = _formatDate(rangeStart);
    state.dom.endDate.value   = _formatDate(today);
    state.dom.endDate.max     = _formatDate(today);
};

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO
// ==========================================================================

const _formatDate = (date) => date.toISOString().split('T')[0];

const _formatDateOnly = (val) => val ? String(val).substring(0, 10) : '—';

const _formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const _formatDatetime = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

const _formatCell = (value, format) => {
    if (value === null || value === undefined) return '—';
    if (format === 'currency') return _formatCurrency(value);
    if (format === 'datetime') return _formatDatetime(value);
    if (format === 'date') return _formatDateOnly(value);
    return String(value);
};

export const render = {
    /**
     * Renderiza los KPIs del periodo consultado
     */
    kpis: (summaryData) => {
        if (!summaryData || summaryData.length === 0) {
            state.dom.kpiTickets.textContent   = '0';
            state.dom.kpiRevenue.textContent   = '$0.00';
            state.dom.kpiAvgTicket.textContent  = '$0.00';
            state.dom.kpiTips.textContent       = '$0.00';
            return;
        }

        const totals = summaryData.reduce((acc, row) => {
            acc.tickets += parseInt(row.total_tickets) || 0;
            acc.revenue += parseFloat(row.total_revenue) || 0;
            acc.tips    += parseFloat(row.total_tips) || 0;
            return acc;
        }, { tickets: 0, revenue: 0, tips: 0 });

        state.dom.kpiTickets.textContent   = totals.tickets.toLocaleString('es-MX');
        state.dom.kpiRevenue.textContent   = _formatCurrency(totals.revenue);
        state.dom.kpiAvgTicket.textContent  = _formatCurrency(totals.tickets > 0 ? totals.revenue / totals.tickets : 0);
        state.dom.kpiTips.textContent       = _formatCurrency(totals.tips);
    },

    /**
     * Renderiza la tabla con los datos del tab activo
     */
    table: () => {
        const tab     = state.ui.activeTab;
        const headers = uiConfig.tableHeaders[tab];
        const dataMap = {
            'resumen':    state.datos.summary,
            'categorias': state.datos.categories,
            'platillos':  state.datos.topDishes,
            'meseros':    state.datos.waiters,
            'detalle':    state.datos.detail
        };
        const data = dataMap[tab] || [];

        // Render header
        state.dom.tableHead.innerHTML = '';
        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.className = 'px-4 py-3 text-left';
            th.textContent = h.label;
            headerRow.appendChild(th);
        });
        state.dom.tableHead.appendChild(headerRow);

        // Render body
        state.dom.tableBody.innerHTML = '';

        if (data.length === 0) {
            state.dom.emptyState.classList.remove('hidden');
            state.dom.chartContainer.classList.add('hidden');
            return;
        }

        state.dom.emptyState.classList.add('hidden');
        state.dom.chartContainer.classList.remove('hidden');

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';

            headers.forEach(h => {
                const td = document.createElement('td');
                td.className = 'px-4 py-3 text-slate-700';

                // 🟢 FIX: Busca la llave en formato original (snake) o formato JSON (camel)
                const camelKey = h.key.replace(/_([a-z])/g, g => g[1].toUpperCase());
                const valor = row[h.key] !== undefined ? row[h.key] : row[camelKey];

                if (h.key === 'payment_method') {
                    const badge = document.createElement('span');
                    const method = valor || 'DEFAULT';
                    badge.className = `px-2 py-0.5 text-xs rounded-full ${uiConfig.paymentBadges[method] || uiConfig.paymentBadges.DEFAULT}`;
                    badge.textContent = method;
                    td.appendChild(badge);
                } else {
                    td.textContent = _formatCell(valor, h.format);
                }

                tr.appendChild(td);
            });

            state.dom.tableBody.appendChild(tr);
        });
    },

    /**
     * Renderiza la gráfica según el tab activo
     */
    chart: () => {
        // Destruir gráfica anterior si existe
        if (state.ui.chartInstance) {
            state.ui.chartInstance.destroy();
            state.ui.chartInstance = null;
        }

        const tab = state.ui.activeTab;
        const ctx = state.dom.chartCanvas.getContext('2d');
        const colors = uiConfig.chartColors;

        let config = null;

        if (tab === 'resumen' && state.datos.summary.length > 0) {
            config = {
                type: 'line',
                data: {
                    labels: state.datos.summary.map(r => _formatDateOnly(r.sale_date)),
                    datasets: [{
                        label: 'Ingreso',
                        data: state.datos.summary.map(r => parseFloat(r.total_revenue)),
                        borderColor: colors.primary,
                        backgroundColor: colors.bg,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: _chartOptions('Ingreso por Día')
            };
        } else if (tab === 'categorias' && state.datos.categories.length > 0) {
            config = {
                type: 'doughnut',
                data: {
                    labels: state.datos.categories.map(r => r.category_name),
                    datasets: [{
                        data: state.datos.categories.map(r => parseFloat(r.revenue)),
                        backgroundColor: _generatePalette(state.datos.categories.length)
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'right' } } }
            };
        } else if (tab === 'platillos' && state.datos.topDishes.length > 0) {
            config = {
                type: 'bar',
                data: {
                    labels: state.datos.topDishes.map(r => r.dish_name),
                    datasets: [{
                        label: 'Unidades Vendidas',
                        data: state.datos.topDishes.map(r => parseInt(r.total_quantity)),
                        backgroundColor: colors.primary,
                        borderRadius: 4
                    }]
                },
                options: _chartOptions('Top Platillos')
            };
        } else if (tab === 'meseros' && state.datos.waiters.length > 0) {
            config = {
                type: 'bar',
                data: {
                    labels: state.datos.waiters.map(r => r.waiter_name),
                    datasets: [
                        {
                            label: 'Ingreso',
                            data: state.datos.waiters.map(r => parseFloat(r.total_revenue)),
                            backgroundColor: colors.primary,
                            borderRadius: 4
                        },
                        {
                            label: 'Propinas',
                            data: state.datos.waiters.map(r => parseFloat(r.total_tips)),
                            backgroundColor: colors.accent,
                            borderRadius: 4
                        }
                    ]
                },
                options: _chartOptions('Rendimiento por Mesero')
            };
        }

        if (config && typeof Chart !== 'undefined') {
            state.ui.chartInstance = new Chart(ctx, config);
        }
    },

    /**
     * Marca el tab activo visualmente
     */
    setActiveTab: (tabName) => {
        state.ui.activeTab = tabName;
        const tabConfig = uiConfig.tabs;

        state.dom.tabs.querySelectorAll('.report-tab').forEach(btn => {
            const isActive = btn.getAttribute('data-tab') === tabName;
            btn.className = `report-tab px-5 py-3 text-sm font-medium border-b-2 ${isActive ? tabConfig.resumen.active : tabConfig.resumen.inactive}`;
        });
    }
};

// ── Utilidades de gráfica (privadas) ──────────────────────────

const _chartOptions = (title) => ({
    responsive: true,
    plugins: {
        legend: { display: true },
        title: { display: false }
    },
    scales: {
        y: {
            beginAtZero: true,
            grid: { color: uiConfig.chartColors.grid }
        },
        x: {
            grid: { display: false }
        }
    }
});

const _generatePalette = (count) => {
    const base = [
        'rgba(99, 102, 241, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(14, 165, 233, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(168, 85, 247, 0.8)'
    ];
    return Array.from({ length: count }, (_, i) => base[i % base.length]);
};
