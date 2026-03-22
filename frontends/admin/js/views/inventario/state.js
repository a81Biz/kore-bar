// frontends/admin/js/views/inventario/state.js

export const state = {
    dom: {},
    data: {
        suppliers: [],
        stockBodega: [],
        stockCocina: [],
        kardex: []
    },
    ui: {
        showOnlySuggested: false,
        selectedSupplierCode: null,
        kardexLocation: '',
        kardexSearchQuery: ''
    }
};

// Diccionario UI (Cero lógica de negocio en el renderizado)
export const uiConfig = {
    tabs: {
        active: 'px-6 py-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 bg-white transition-colors',
        inactive: 'px-6 py-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors'
    },
    transactionType: {
        'IN': { badge: 'bg-emerald-100 text-emerald-800', label: 'ENTRADA' },
        'OUT': { badge: 'bg-orange-100 text-orange-800', label: 'SALIDA/MERMA' },
        'ADJ': { badge: 'bg-slate-100 text-slate-800', label: 'AJUSTE' },
        'TRANSFER': { badge: 'bg-purple-100 text-purple-800', label: 'TRASPASO' },
        'DEFAULT': { badge: 'bg-slate-100 text-slate-800', label: 'INDEFINIDO' }
    },
    stockStatus: {
        'OK': { badge: 'bg-emerald-100 text-emerald-800', label: 'ÓPTIMO' },
        'CRITICAL': { badge: 'bg-red-100 text-red-800', label: 'COMPRAR' }
    }
};