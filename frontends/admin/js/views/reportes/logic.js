// ============================================================
// views/reportes/logic.js
// Sección 5: Lógica de Negocio / Datos
// ============================================================
import { fetchData }    from '/shared/js/http.client.js';
import { ENDPOINTS }    from '/shared/js/endpoints.js';
import { showErrorModal } from '/shared/js/ui.js';
import { state }        from './state.js';
import { render }       from './view.js';

export const logic = {

    /**
     * Carga todos los reportes del periodo seleccionado
     */
    loadAll: async () => {
        const startDate = state.dom.startDate.value;
        const endDate   = state.dom.endDate.value;

        if (!startDate || !endDate) {
            showErrorModal('Selecciona un rango de fechas.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            showErrorModal('La fecha de inicio no puede ser posterior a la fecha de fin.');
            return;
        }

        state.ui.startDate = startDate;
        state.ui.endDate   = endDate;

        // Loading state en botón
        state.dom.btnFilter.disabled  = true;
        state.dom.btnFilter.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">progress_activity</span> Consultando...';

        try {
            // Cargar en paralelo todos los reportes del periodo
            const [summaryRes, categoriesRes, topDishesRes, waitersRes, detailRes] = await Promise.all([
                fetchData(`${ENDPOINTS.admin.get.reports.salesSummary}?startDate=${startDate}&endDate=${endDate}`),
                fetchData(`${ENDPOINTS.admin.get.reports.salesByCategory}?startDate=${startDate}&endDate=${endDate}`),
                fetchData(`${ENDPOINTS.admin.get.reports.topDishes}?startDate=${startDate}&endDate=${endDate}&limit=15`),
                fetchData(`${ENDPOINTS.admin.get.reports.salesByWaiter}?startDate=${startDate}&endDate=${endDate}`),
                fetchData(`${ENDPOINTS.admin.get.reports.sales}?startDate=${startDate}&endDate=${endDate}`)
            ]);

            state.datos.summary    = summaryRes.data    || [];
            state.datos.categories = categoriesRes.data  || [];
            state.datos.topDishes  = topDishesRes.data   || [];
            state.datos.waiters    = waitersRes.data     || [];
            state.datos.detail     = detailRes.data      || [];

            // Renderizar todo
            render.kpis(state.datos.summary);
            render.table();
            render.chart();

        } catch (error) {
            showErrorModal(error.message);
        } finally {
            state.dom.btnFilter.disabled  = false;
            state.dom.btnFilter.innerHTML = '<span class="material-symbols-outlined text-lg">search</span> Consultar';
        }
    },

    /**
     * Cambia el tab activo y re-renderiza tabla + gráfica
     */
    switchTab: (tabName) => {
        render.setActiveTab(tabName);
        render.table();
        render.chart();
    },

    /**
     * Exporta los datos del tab activo a CSV
     */
    exportCSV: () => {
        const tab     = state.ui.activeTab;
        const headers = state.datos.summary.length === 0 ? [] :
            Object.keys(_getActiveData()[0] || {});
        const data    = _getActiveData();

        if (data.length === 0) {
            showErrorModal('No hay datos para exportar. Realiza una consulta primero.');
            return;
        }

        // Construir CSV
        const csvRows = [];
        csvRows.push(headers.join(','));

        data.forEach(row => {
            const values = headers.map(h => {
                const val = row[h];
                // Escapar comas y comillas
                const escaped = String(val ?? '').replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob      = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
        const url       = URL.createObjectURL(blob);

        const link  = document.createElement('a');
        link.href   = url;
        link.download = `reporte_${tab}_${state.ui.startDate}_${state.ui.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
};

// ── Utilidades privadas ───────────────────────────────────────

const _getActiveData = () => {
    const dataMap = {
        'resumen':    state.datos.summary,
        'categorias': state.datos.categories,
        'platillos':  state.datos.topDishes,
        'meseros':    state.datos.waiters,
        'detalle':    state.datos.detail
    };
    return dataMap[state.ui.activeTab] || [];
};
