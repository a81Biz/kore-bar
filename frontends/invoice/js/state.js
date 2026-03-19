// ============================================================
// state.js — Estado del Portal de Facturación
// ============================================================

export const state = {
    step: 'search',   // 'search' | 'form' | 'done'
    folio: null,
    ticket: null,     // datos del ticket de la API
    isLoading: false,
};
