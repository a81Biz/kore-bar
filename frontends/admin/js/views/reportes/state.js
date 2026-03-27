// ============================================================
// views/reportes/state.js
// Sección 2: Estado Privado y Configuración
// ============================================================

export const state = {
    datos: {
        summary:      [],
        categories:   [],
        topDishes:    [],
        waiters:      [],
        detail:       [],
        kpis:         {}
    },
    ui: {
        activeTab:    'resumen',
        startDate:    '',
        endDate:      '',
        chartInstance: null
    },
    dom: {}
};

// Diccionario UI: mapeo de tabs a headers de tabla
export const uiConfig = {
    tabs: {
        'resumen':    { active: 'border-indigo-600 text-indigo-600', inactive: 'border-transparent text-slate-500 hover:text-slate-700' },
    },
    tableHeaders: {
        'resumen': [
            { key: 'sale_date',       label: 'Fecha' },
            { key: 'total_tickets',   label: 'Tickets' },
            { key: 'total_items_sold',label: 'Platillos' },
            { key: 'total_revenue',   label: 'Ingreso',     format: 'currency' },
            { key: 'total_tax',       label: 'IVA',         format: 'currency' },
            { key: 'total_tips',      label: 'Propinas',    format: 'currency' },
            { key: 'avg_ticket',      label: 'Ticket Prom', format: 'currency' },
            { key: 'tables_served',   label: 'Mesas' }
        ],
        'categorias': [
            { key: 'category_name',   label: 'Categoría' },
            { key: 'items_sold',      label: 'Unidades' },
            { key: 'revenue',         label: 'Ingreso',     format: 'currency' }
        ],
        'platillos': [
            { key: 'dish_name',       label: 'Platillo' },
            { key: 'category_name',   label: 'Categoría' },
            { key: 'total_quantity',  label: 'Vendidos' },
            { key: 'total_revenue',   label: 'Ingreso',     format: 'currency' },
            { key: 'current_price',   label: 'Precio Actual', format: 'currency' }
        ],
        'meseros': [
            { key: 'waiter_name',     label: 'Mesero' },
            { key: 'waiter_number',   label: 'No. Empleado' },
            { key: 'tickets_closed',  label: 'Tickets' },
            { key: 'total_revenue',   label: 'Ingreso',     format: 'currency' },
            { key: 'total_tips',      label: 'Propinas',    format: 'currency' },
            { key: 'avg_ticket',      label: 'Ticket Prom', format: 'currency' }
        ],
        'detalle': [
            { key: 'ticket_folio',    label: 'Folio' },
            { key: 'ticket_date',     label: 'Fecha',       format: 'datetime' },
            { key: 'table_code',      label: 'Mesa' },
            { key: 'waiter_name',     label: 'Mesero' },
            { key: 'dish_name',       label: 'Platillo' },
            { key: 'item_quantity',   label: 'Cant' },
            { key: 'item_unit_price', label: 'Precio',      format: 'currency' },
            { key: 'item_total',      label: 'Total',       format: 'currency' },
            { key: 'payment_method',  label: 'Pago' }
        ]
    },
    chartColors: {
        primary:   'rgba(99, 102, 241, 0.8)',
        secondary: 'rgba(16, 185, 129, 0.8)',
        accent:    'rgba(245, 158, 11, 0.8)',
        bg:        'rgba(99, 102, 241, 0.1)',
        grid:      'rgba(148, 163, 184, 0.2)'
    },
    paymentBadges: {
        'CASH':     'bg-emerald-100 text-emerald-800',
        'CARD':     'bg-blue-100 text-blue-800',
        'TRANSFER': 'bg-purple-100 text-purple-800',
        'MIXED':    'bg-amber-100 text-amber-800',
        'DEFAULT':  'bg-slate-100 text-slate-800'
    }
};
