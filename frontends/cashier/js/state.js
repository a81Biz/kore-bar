// ============================================================
// state.js — Estado global del módulo de Caja
// ============================================================

export const state = {
    // Sesión del cajero autenticado
    cashier: null,       // { employeeNumber, firstName, lastName }

    // Tablero de mesas en espera de pago
    board: [],           // [{ tableCode, zoneName, orderCode, total, waitingSince, waiterName }]
    boardPollInterval: null,

    // Mesa seleccionada en el tablero
    selectedTable: null, // objeto de board[]

    // Desglose de consumo de la mesa seleccionada (del ticket de detalle)
    orderItems: [],      // [{ name, quantity, unitPrice, subtotal }]

    // Cobro mixto acumulado en el modal de pago
    paymentLines: [],    // [{ method, amount }]
    tip: 0,

    // Ticket generado al confirmar pago
    lastFolio: null,

    // Datos del Corte Z
    corte: null,

    // UI
    currentScreen: 'login', // 'login' | 'board' | 'payment' | 'corte'
    isLoading: false,
    toast: null,
};
