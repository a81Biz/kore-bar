// ============================================================
// cashier/js/logic.js — Lógica de negocio del Módulo de Caja
// ============================================================
//
// ✅ Usa http.client.js (fetchData / postData) en lugar de fetch() directo.
// ✅ Usa ENDPOINTS en lugar de URLs hardcodeadas.
// ✅ No contiene lógica de renderizado — toda la UI vive en view.js.

import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { state } from './state.js';
import {
    renderLoginScreen, renderBoard, renderTableDetail,
    renderPaymentModal, renderTicketSuccess, renderCorteModal,
    showToast, showLoading
} from './view.js';

// ── 1. Cargar empleados elegibles y mostrar pantalla de login ──────────────
export const initLogin = async () => {
    state.currentScreen = 'login';
    state.cashier = null;
    stopBoardPolling();
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
    const pin = document.getElementById('inp-pin')?.value;

    if (!employeeNumber) { showToast('Selecciona tu nombre', 'error'); return; }
    if (!pin || pin.length < 4) { showToast('Ingresa tu PIN (mínimo 4 dígitos)', 'error'); return; }

    showLoading(true);
    try {
        const json = await postData(ENDPOINTS.cashier.post.login, { employeeNumber, pin });
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
    startBoardPolling();
};

// ── 4. Cargar el tablero desde la API ──────────────────────────────────────
export const loadBoard = async () => {
    try {
        const json = await fetchData(ENDPOINTS.cashier.get.board);
        state.board = json.data?.body?.tables || json.data?.tables || [];
        renderBoard();
        attachBoardEvents();
    } catch (e) {
        showToast('Error cargando el tablero', 'error');
    }
};

// Polling automático cada 15 s
function startBoardPolling() {
    stopBoardPolling();
    state.boardPollInterval = setInterval(() => {
        if (state.currentScreen === 'board') loadBoard();
    }, 15000);
}
function stopBoardPolling() {
    if (state.boardPollInterval) {
        clearInterval(state.boardPollInterval);
        state.boardPollInterval = null;
    }
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
        stopBoardPolling();
        initLogin();
    });

    document.getElementById('btn-open-payment')?.addEventListener('click', openPaymentModal);
}

// ── 5. Seleccionar mesa y cargar su detalle de consumo ─────────────────────
async function selectTable(table) {
    state.selectedTable = table;
    state.paymentLines = [];
    state.tip = 0;
    state.orderItems = [];

    renderBoard();
    attachBoardEvents();

    // Cargar desglose de consumo usando el endpoint de meseros (order status)
    try {
        const json = await fetchData(
            ENDPOINTS.waiters.get.orderStatus.replace(':tableCode', table.tableCode)
        );
        const d = json.data?.body || json.data || {};
        state.orderItems = (d.items || []).map(i => ({
            name: i.name || i.dish_name,
            quantity: i.quantity,
            unitPrice: parseFloat(i.unit_price || i.unitPrice || 0),
            subtotal: parseFloat(i.subtotal || 0)
        }));
    } catch {
        state.orderItems = [];
    }

    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel) {
        detailPanel.innerHTML = renderTableDetail();
    }
    document.getElementById('btn-open-payment')?.addEventListener('click', openPaymentModal);
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
        });
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
    });

    document.getElementById('btn-confirm-payment')?.addEventListener('click', confirmPayment);
}

// ── 7. Confirmar pago ──────────────────────────────────────────────────────
async function confirmPayment() {
    const { selectedTable, paymentLines, tip, cashier } = state;
    if (!selectedTable || paymentLines.length === 0) return;

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