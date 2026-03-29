// ============================================================
// cashier/js/logic.js — Lógica de negocio del Módulo de Caja
// ============================================================
//
// ✅ Usa http.client.js (fetchData / postData) en lugar de fetch() directo.
// ✅ Usa ENDPOINTS en lugar de URLs hardcodeadas.
// ✅ No contiene lógica de renderizado — toda la UI vive en view.js.
// ✅ Supabase Realtime reemplaza polling de 15s.
//    Fallback: polling conservador (30s, solo con pestaña visible) para Docker local.

import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { waitForEnv } from '/core/js/kore.env.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { state } from './state.js';
import {
    renderLoginScreen, renderBoard, renderTableDetail,
    renderPaymentModal, renderTicketSuccess, renderCorteModal,
    showToast, showLoading, updatePaymentSummaryUI
} from './view.js';
import { TicketPrinter } from './ticket-print.js';

// ── Realtime / Fallback state ──────────────────────────────────────────────
let _realtimeChannel = null;
let _fallbackInterval = null;
let _visibilityHandler = null;

// ── 1. Cargar empleados elegibles y mostrar pantalla de login ──────────────
export const initLogin = async () => {
    state.currentScreen = 'login';
    state.cashier = null;
    stopRealtime();
    // Inicializar el módulo de impresión al arrancar (cachea el DOM del ticket)
    TicketPrinter.init();
    showLoading(true);
    try {
        const json = await fetchData(ENDPOINTS.cashier.get.employees);
        const employees = json.data?.body?.employees || json.data?.employees || [];
        renderLoginScreen(employees);
        attachLoginEvents();
    } catch (e) {
        renderLoginScreen([]);
        showToast('Error cargando empleados: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
};

// ── Eventos del login ──────────────────────────────────────────────────────
function attachLoginEvents() {
    const inpPin = document.getElementById('inp-pin');
    const btnLogin = document.getElementById('btn-login');

    // Teclado PIN numérico
    document.querySelectorAll('.pin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            if (key === '⌫') {
                inpPin.value = inpPin.value.slice(0, -1);
            } else if (key === 'OK') {
                handleLogin();
            } else {
                if (inpPin.value.length < 6) inpPin.value += key;
            }
        });
    });

    inpPin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    btnLogin.addEventListener('click', handleLogin);
}

// ── 2. Autenticar cajero ───────────────────────────────────────────────────
async function handleLogin() {
    const employeeNumber = document.getElementById('sel-employee')?.value;
    const pinCode = document.getElementById('inp-pin')?.value;

    if (!employeeNumber) { showToast('Selecciona tu nombre', 'error'); return; }
    if (!pinCode || pinCode.length < 4) { showToast('Ingresa tu PIN (mínimo 4 dígitos)', 'error'); return; }

    showLoading(true);
    try {
        const json = await postData(ENDPOINTS.cashier.post.login, { employeeNumber, pinCode, context: 'cashier' });
        const d = json.data?.body || json.data || {};
        state.cashier = {
            employeeNumber: d.employeeNumber || employeeNumber,
            firstName: d.firstName || '',
            lastName: d.lastName || ''
        };
        await initBoard();
    } catch (e) {
        // http.client ya extrae el mensaje de jsonResponse.error
        const msg = e.message?.toLowerCase().includes('403') || e.message?.includes('acceso')
            ? 'Sin permiso de acceso a caja'
            : 'PIN o usuario incorrecto';
        showToast(msg, 'error');
        document.getElementById('inp-pin').value = '';
    } finally {
        showLoading(false);
    }
}

// ── 3. Iniciar tablero ─────────────────────────────────────────────────────
export const initBoard = async () => {
    state.currentScreen = 'board';
    state.selectedTable = null;
    state.orderItems = [];
    await loadBoard();
    await startRealtime();
};

// ── 4. Cargar el tablero desde la API ──────────────────────────────────────
export const loadBoard = async () => {
    try {
        const json = await fetchData(ENDPOINTS.cashier.get.board);
        const newBoard = json.data?.body?.tables || json.data?.tables || [];
        state.board = newBoard;

        if (state.selectedTable) {
            const updated = newBoard.find(t => t.tableCode === state.selectedTable.tableCode);
            if (!updated) {
                // Mesa ya cobrada — limpiar selección
                state.selectedTable = null;
                state.orderItems = [];
                renderBoard();
                attachBoardEvents();
            } else {
                // Actualizar datos sin perder el panel de detalle
                state.selectedTable = updated;
                renderBoard();
                attachBoardEvents();
                // FIX: re-renderizar detalle y re-agregar listener tras polling
                renderTableDetail();
                document.getElementById('btn-open-payment')
                    ?.addEventListener('click', openPaymentModal);
            }
        } else {
            renderBoard();
            attachBoardEvents();
        }
    } catch (e) {
        showToast('Error cargando el tablero', 'error');
    }
};

// ── Supabase Realtime (reemplaza polling de 15s) ───────────────────────────
async function startRealtime() {
    stopRealtime();

    try {
        // Esperar credenciales con timeout de 3s — si no hay Supabase, fallback
        const env = await Promise.race([
            waitForEnv(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('env timeout')), 3000)
            )
        ]);

        const { supabaseUrl, supabaseAnonKey } = env || {};
        if (!supabaseUrl || !supabaseAnonKey) throw new Error('sin credenciales Supabase');

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        _realtimeChannel = supabase
            .channel('cashier-board')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'order_headers' },
                (payload) => {
                    const status = payload.new?.status;
                    // Refrescar tablero cuando una orden entra o sale de AWAITING_PAYMENT
                    if (['AWAITING_PAYMENT', 'CLOSED'].includes(status)) {
                        if (state.currentScreen === 'board') loadBoard();
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'order_headers' },
                () => {
                    // Nueva orden creada — refrescar por si acaso
                    if (state.currentScreen === 'board') loadBoard();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Cashier] Realtime conectado — polling desactivado');
                }
            });

    } catch (e) {
        console.warn('[Cashier] Supabase no disponible, activando polling conservador:', e.message);
        startFallbackPolling();
    }
}

// ── Fallback: polling conservador para Docker local ────────────────────────
// Solo hace fetch cuando la pestaña está visible, cada 30s.
// Al volver a la pestaña después de estar oculta, refresca inmediatamente.
function startFallbackPolling() {
    stopFallbackPolling();

    _fallbackInterval = setInterval(() => {
        if (state.currentScreen === 'board' && document.visibilityState === 'visible') {
            loadBoard();
        }
    }, 10000);

    _visibilityHandler = () => {
        if (document.visibilityState === 'visible' && state.currentScreen === 'board') {
            loadBoard();  // Refresh inmediato al volver a la pestaña
        }
    };
    document.addEventListener('visibilitychange', _visibilityHandler);
}

function stopFallbackPolling() {
    if (_fallbackInterval) {
        clearInterval(_fallbackInterval);
        _fallbackInterval = null;
    }
    if (_visibilityHandler) {
        document.removeEventListener('visibilitychange', _visibilityHandler);
        _visibilityHandler = null;
    }
}

function stopRealtime() {
    _realtimeChannel?.unsubscribe();
    _realtimeChannel = null;
    stopFallbackPolling();
}

// ── Eventos del tablero ────────────────────────────────────────────────────
function attachBoardEvents() {
    document.querySelectorAll('.board-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tableCode = btn.dataset.table;
            const found = state.board.find(t => t.tableCode === tableCode);
            if (found) selectTable(found);
        });
    });

    document.getElementById('btn-corte')?.addEventListener('click', openCorte);

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        stopRealtime();
        initLogin();
    });

    // FIX 3: btn-open-payment NO existe aquí (está en tpl-cashier-detail, no en tpl-cashier-board).
    // Se agrega en selectTable() DESPUÉS de que renderTableDetail() lo crea.
    // Eliminar la línea siguiente que siempre fallaba silenciosamente:
    // document.getElementById('btn-open-payment')?.addEventListener('click', openPaymentModal);
}

// ── 5. Seleccionar mesa y cargar su detalle de consumo ─────────────────────
async function selectTable(table) {
    state.selectedTable = table;
    state.paymentLines = [];
    state.tip = 0;
    state.orderItems = [];

    renderBoard();
    attachBoardEvents();

    // Cargar items de la orden (busca OPEN o AWAITING_PAYMENT con el fix del modelo)
    try {
        const json = await fetchData(
            ENDPOINTS.waiters.get.orderStatus.replace(':tableCode', table.tableCode)
        );
        const items = json.data?.body?.items || json.data?.items || [];
        state.orderItems = items.map(i => ({
            name: i.name || i.dish_name || '',
            quantity: i.quantity ?? 1,
            unitPrice: parseFloat(i.unit_price ?? i.unitPrice ?? i.price ?? 0),
            subtotal: parseFloat(i.subtotal ?? 0)
        }));
    } catch {
        state.orderItems = [];
    }

    // FIX 1: renderTableDetail() es void — manipula el DOM directamente.
    //         Antes: detailPanel.innerHTML = renderTableDetail() → innerHTML = undefined → panel vacío.
    renderTableDetail();

    // FIX 2: btn-open-payment vive en tpl-cashier-detail.
    //         attachBoardEvents() se ejecuta antes de renderTableDetail() → no existe aún → listener no se agrega.
    //         Hay que agregarlo DESPUÉS de renderTableDetail().
    document.getElementById('btn-open-payment')
        ?.addEventListener('click', openPaymentModal);
}
// ── 6. Modal de pago ───────────────────────────────────────────────────────
function openPaymentModal() {
    state.paymentLines = [];
    state.tip = 0;
    renderPaymentModal();
    attachPaymentEvents();
}

function attachPaymentEvents() {
    document.getElementById('btn-close-payment')?.addEventListener('click', () => {
        document.getElementById('payment-modal')?.remove();
    });

    document.querySelectorAll('.quick-amount').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('inp-amount').value = btn.dataset.quick;
            updatePaymentSummaryUI();
        });
    });

    document.getElementById('inp-amount')?.addEventListener('input', () => {
        updatePaymentSummaryUI();
    });

    document.getElementById('btn-add-line')?.addEventListener('click', () => {
        const method = document.getElementById('sel-method').value;
        const amount = parseFloat(document.getElementById('inp-amount').value);
        if (!amount || amount <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
        state.paymentLines.push({ method, amount });
        state.tip = parseFloat(document.getElementById('inp-tip').value) || 0;
        renderPaymentModal();
        attachPaymentEvents();
    });

    document.querySelectorAll('.btn-rm-line').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            state.paymentLines.splice(idx, 1);
            renderPaymentModal();
            attachPaymentEvents();
        });
    });

    document.getElementById('inp-tip')?.addEventListener('input', (e) => {
        state.tip = parseFloat(e.target.value) || 0;
        updatePaymentSummaryUI();
    });

    document.getElementById('btn-confirm-payment')?.addEventListener('click', confirmPayment);
}

async function confirmPayment() {
    const { selectedTable, tip, cashier, paymentLines } = state;
    if (!selectedTable) return;

    const currentInputAmt = parseFloat(document.getElementById('inp-amount')?.value) || 0;
    const paidSoFar = paymentLines.reduce((s, l) => s + l.amount, 0);
    const totalToPay = selectedTable.total + (parseFloat(tip) || 0);

    // Auto-add the typed amount if it helps cover what's missing
    if (paidSoFar < totalToPay && currentInputAmt > 0 && (paidSoFar + currentInputAmt >= totalToPay)) {
        const method = document.getElementById('sel-method')?.value || 'CASH';
        state.paymentLines.push({ method, amount: currentInputAmt });
    }

    if (paymentLines.length === 0) return;

    showLoading(true);
    try {
        const json = await postData(
            ENDPOINTS.cashier.post.pay,
            {
                cashierCode: cashier.employeeNumber,
                payments: paymentLines,
                tip: tip || 0
            },
            { tableCode: selectedTable.tableCode } // ← reemplaza :tableCode en la URL
        );

        const d = json.data?.body || json.data || {};
        state.lastFolio = d.folio;

        renderTicketSuccess(d.folio, d.total || selectedTable.total);

        // Imprimir ticket térmico automáticamente tras cobro exitoso
        await TicketPrinter.print(d.folio);

        document.getElementById('btn-close-success')?.addEventListener('click', async () => {
            document.getElementById('payment-modal')?.remove();
            state.selectedTable = null;
            state.orderItems = [];
            await loadBoard();
            attachBoardEvents();
        });

        showToast(`Ticket emitido: ${d.folio}`, 'success');
    } catch (e) {
        showToast('Error al procesar el pago: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ── 8. Corte Z ─────────────────────────────────────────────────────────────
async function openCorte() {
    showLoading(true);
    try {
        const json = await fetchData(ENDPOINTS.cashier.get.corte);
        const corte = json.data?.body?.corte || json.data?.corte || {};
        renderCorteModal(corte);
        document.getElementById('btn-close-corte')?.addEventListener('click', () => {
            document.getElementById('corte-modal')?.remove();
        });
    } catch (e) {
        showToast('Error cargando el corte: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}