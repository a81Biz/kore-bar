// ==========================================================================
// frontends/admin/js/views/dashboard.js
// Controlador del Dashboard con KPIs dinámicos
// Área 3 — doc 10_guia_integracion_mejoras.md
// Patrón: Módulo de 7 secciones
// ==========================================================================

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

// ==========================================================================
// 2. ESTADO PRIVADO
// ==========================================================================
const _datos = {
    kpis: null
};

const _dom = {
    zonas:      null,
    mesas:      null,
    personal:   null,
    meseros:    null,
    categorias: null,
    platillos:  null,
    ventasDia:  null,
    ticketsDia: null,
    capacidad:  null
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const _cacheDOM = (container) => {
    _dom.zonas      = container.querySelector('#kpi-zonas');
    _dom.mesas      = container.querySelector('#kpi-mesas');
    _dom.personal   = container.querySelector('#kpi-personal');
    _dom.meseros    = container.querySelector('#kpi-meseros');
    _dom.categorias = container.querySelector('#kpi-categorias');
    _dom.platillos  = container.querySelector('#kpi-platillos');
    _dom.ventasDia  = container.querySelector('#kpi-ventas-dia');
    _dom.ticketsDia = container.querySelector('#kpi-tickets-dia');
    _dom.capacidad  = container.querySelector('#kpi-capacidad');
};

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO
// ==========================================================================
const _fmt = {
    int: (val) => val != null ? Number(val).toLocaleString('es-MX') : '—',
    currency: (val) => val != null
        ? `$${Number(val).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—'
};

const _render = {
    kpis: () => {
        const d = _datos.kpis;
        if (!d) return;

        if (_dom.zonas)      _dom.zonas.textContent      = _fmt.int(d.active_zones);
        if (_dom.mesas)      _dom.mesas.textContent      = _fmt.int(d.active_tables);
        if (_dom.personal)   _dom.personal.textContent   = _fmt.int(d.active_employees);
        if (_dom.meseros)    _dom.meseros.textContent    = _fmt.int(d.active_waiters);
        if (_dom.categorias) _dom.categorias.textContent = _fmt.int(d.active_categories);
        if (_dom.platillos)  _dom.platillos.textContent  = _fmt.int(d.active_dishes);
        if (_dom.ventasDia)  _dom.ventasDia.textContent  = _fmt.currency(d.today_revenue);
        if (_dom.ticketsDia) _dom.ticketsDia.textContent = _fmt.int(d.today_tickets);
        if (_dom.capacidad)  _dom.capacidad.textContent  = _fmt.int(d.total_capacity);
    }
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS
// ==========================================================================
const _logic = {
    loadData: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.dashboardKpis);
            // El endpoint devuelve data.body o data directamente según el helper
            _datos.kpis = res.data?.body || res.data || null;
            _render.kpis();
        } catch (err) {
            console.error('[DashboardController] Error cargando KPIs:', err);
            // No bloquear la UI — el HTML muestra '—' por defecto
        }
    }
};

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
const _bindEvents = () => {
    // Sin eventos interactivos en el dashboard por ahora.
    // Futuro: botón de actualizar manual, drill-down por KPI.
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const mount = async (container) => {
    console.log('[DashboardController] Montando vista...');
    _cacheDOM(container);
    _bindEvents();
    await _logic.loadData();
};