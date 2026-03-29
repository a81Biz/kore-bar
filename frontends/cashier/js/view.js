// ============================================================
// cashier/js/view.js — Renderizado del Módulo de Caja
// Usa exclusivamente <template> + cloneNode(true).
// Sin lógica de negocio ni llamadas a API.
// ============================================================

import { state } from './state.js';

const app = document.getElementById('app');

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtTime = (iso) => {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  return diff < 1 ? 'Ahora' : `Hace ${diff} min`;
};

const cloneTemplate = (id) => {
  const tpl = document.getElementById(id);
  if (!tpl) throw new Error(`[View] Template no encontrado: ${id}`);
  return tpl.content.cloneNode(true);
};

// Diccionario UI — cero condicionales en el render
const _uiConfig = {
  pinKeys: [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'],
  pinStyle: {
    'OK': 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-400',
    '⌫': 'bg-slate-600 text-slate-200 hover:bg-slate-500',
    DEFAULT: 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600'
  },
  methodLabel: { CASH: '💵 Efectivo', CARD: '💳 Tarjeta', TRANSFER: '📱 Transferencia' },
  methodIcon: { CASH: 'payments', CARD: 'credit_card', TRANSFER: 'phone_iphone' }
};

// ── Toast ──────────────────────────────────────────────────────────────────
export const showToast = (msg, type = 'success') => {
  document.getElementById('toast')?.remove();

  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  const icons = { success: 'check_circle', error: 'error', info: 'info' };

  const el = document.createElement('div');
  el.id = 'toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-white font-semibold shadow-2xl ${colors[type]} animate-slide-up`;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'material-symbols-outlined';
  iconSpan.textContent = icons[type];

  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;

  el.appendChild(iconSpan);
  el.appendChild(msgSpan);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

// ── Spinner ────────────────────────────────────────────────────────────────
export const showLoading = (show) => {
  document.getElementById('loading-overlay')?.classList.toggle('hidden', !show);
};

// ── Screen 1: Login ────────────────────────────────────────────────────────
export const renderLoginScreen = (employees = []) => {
  app.innerHTML = '';
  const clon = cloneTemplate('tpl-cashier-login');

  // Poblar selector de empleados
  const sel = clon.querySelector('#sel-employee');
  employees.forEach(e => {
    const optClon = cloneTemplate('tpl-cashier-emp-option');
    const opt = optClon.querySelector('option');
    opt.value = e.employeeNumber;
    opt.textContent = `${e.firstName} ${e.lastName}`;
    sel.appendChild(optClon);
  });

  // Construir teclado PIN
  const keyboard = clon.querySelector('#pin-keyboard');
  _uiConfig.pinKeys.forEach(k => {
    const btnClon = cloneTemplate('tpl-cashier-pin-btn');
    const btn = btnClon.querySelector('.pin-btn');
    btn.dataset.key = String(k);
    btn.textContent = String(k);
    btn.className += ` ${_uiConfig.pinStyle[k] || _uiConfig.pinStyle.DEFAULT}`;
    keyboard.appendChild(btnClon);
  });

  app.appendChild(clon);
};

// ── Screen 2: Tablero ──────────────────────────────────────────────────────
export const renderBoard = () => {
  const { board, selectedTable, cashier } = state;

  app.innerHTML = '';
  const clon = cloneTemplate('tpl-cashier-board');

  clon.querySelector('.col-cashier-name').textContent =
    cashier ? `${cashier.firstName} ${cashier.lastName}` : '';

  clon.querySelector('.col-board-count').textContent =
    `${board.length} ${board.length === 1 ? 'mesa' : 'mesas'}`;

  const boardList = clon.querySelector('#board-list');
  if (board.length === 0) {
    boardList.appendChild(cloneTemplate('tpl-cashier-board-empty'));
  } else {
    board.forEach(t => {
      const itemClon = cloneTemplate('tpl-cashier-board-item');
      const btn = itemClon.querySelector('.board-item');
      const isSelected = selectedTable?.tableCode === t.tableCode;

      btn.dataset.table = t.tableCode;

      if (isSelected) {
        btn.classList.add('border-amber-500', 'bg-amber-50', 'dark:bg-amber-900/20');
        btn.classList.remove('border-transparent');
        const iconWrap = btn.querySelector('.col-icon');
        iconWrap.classList.replace('bg-slate-200', 'bg-amber-500');
        iconWrap.classList.remove('dark:bg-slate-600');
        const iconEl = iconWrap.querySelector('.material-symbols-outlined');
        iconEl.classList.replace('text-slate-500', 'text-white');
      }

      btn.querySelector('.col-table-code').textContent = `Mesa ${t.tableCode}`;
      btn.querySelector('.col-table-meta').textContent = `${t.waiterName} · ${t.zoneName}`;
      btn.querySelector('.col-total').textContent = fmt(t.total);
      btn.querySelector('.col-time').textContent = fmtTime(t.waitingSince);

      boardList.appendChild(itemClon);
    });
  }

  app.appendChild(clon);
};

// ── Panel derecho: Detalle de mesa ─────────────────────────────────────────
export const renderTableDetail = () => {
  const { selectedTable, orderItems } = state;
  const detailPanel = document.getElementById('detail-panel');
  if (!detailPanel || !selectedTable) return;

  detailPanel.innerHTML = '';
  const clon = cloneTemplate('tpl-cashier-detail');

  clon.querySelector('.col-detail-title').textContent =
    `Mesa ${selectedTable.tableCode} — ${selectedTable.zoneName}`;
  clon.querySelector('.col-detail-meta').textContent =
    `Mesero: ${selectedTable.waiterName} · ${fmtTime(selectedTable.waitingSince)}`;
  clon.querySelector('.col-subtotal').textContent = fmt(selectedTable.total / 1.16);
  clon.querySelector('.col-iva').textContent = fmt(selectedTable.total - selectedTable.total / 1.16);
  clon.querySelector('.col-total').textContent = fmt(selectedTable.total);

  const tbody = clon.querySelector('#detail-items');
  if (orderItems.length === 0) {
    tbody.appendChild(cloneTemplate('tpl-cashier-detail-loading'));
  } else {
    orderItems.forEach(item => {
      const rowClon = cloneTemplate('tpl-cashier-detail-row');
      rowClon.querySelector('.col-qty').textContent = `${item.quantity}x`;
      rowClon.querySelector('.col-name').textContent = item.name;
      rowClon.querySelector('.col-unit-price').textContent = fmt(item.unitPrice);
      rowClon.querySelector('.col-subtotal').textContent = fmt(item.subtotal);
      tbody.appendChild(rowClon);
    });
  }

  detailPanel.appendChild(clon);
};

// ── Modal de Pago ──────────────────────────────────────────────────────────
export const renderPaymentModal = () => {
  const { selectedTable, paymentLines, tip } = state;
  if (!selectedTable) return;

  const totalToPay = selectedTable.total + (parseFloat(tip) || 0);
  const paid = paymentLines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, totalToPay - paid);

  // Crear overlay si no existe
  let overlay = document.getElementById('payment-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'payment-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  const clon = cloneTemplate('tpl-cashier-payment');

  clon.querySelector('.col-payment-subtitle').textContent =
    `Mesa ${selectedTable.tableCode} · Consumo: ${fmt(selectedTable.total)}`;

  // Líneas de cobro
  const linesContainer = clon.querySelector('#payment-lines');
  paymentLines.forEach((l, i) => {
    const lineClon = cloneTemplate('tpl-cashier-pay-line');
    lineClon.querySelector('.col-line-icon').textContent = _uiConfig.methodIcon[l.method] || 'payments';
    lineClon.querySelector('.col-line-method').textContent = _uiConfig.methodLabel[l.method] || l.method;
    lineClon.querySelector('.col-line-amount').textContent = fmt(l.amount);
    lineClon.querySelector('.btn-rm-line').dataset.idx = i;
    linesContainer.appendChild(lineClon);
  });

  // Precargar monto restante
  if (remaining > 0) clon.querySelector('#inp-amount').value = remaining.toFixed(2);
  if (tip) clon.querySelector('#inp-tip').value = tip;

  overlay.appendChild(clon);
  
  updatePaymentSummaryUI();
};

export const updatePaymentSummaryUI = () => {
  const { selectedTable, paymentLines, tip } = state;
  if (!selectedTable) return;

  const totalToPay = selectedTable.total + (parseFloat(tip) || 0);
  const paidAdded = paymentLines.reduce((s, l) => s + l.amount, 0);

  const inpAmountEl = document.getElementById('inp-amount');
  const pendingAmount = inpAmountEl ? (parseFloat(inpAmountEl.value) || 0) : 0;
  // If paymentLines doesn't cover total, we sum what's typed. Otherwise just use added to avoid confusing double counts.
  const virtPaid = paidAdded < totalToPay ? paidAdded + pendingAmount : paidAdded;

  const remaining = Math.max(0, totalToPay - virtPaid);
  const change = Math.max(0, virtPaid - totalToPay);

  const summary = document.getElementById('payment-summary');
  const balanceLabel = document.querySelector('.col-balance-label');
  const balanceAmount = document.querySelector('.col-balance-amount');
  const labelPaid = document.querySelector('.col-paid');
  const labelTotalToPay = document.querySelector('.col-total-to-pay');
  const btnConfirm = document.getElementById('btn-confirm-payment');

  if (!summary || !btnConfirm) return;

  labelPaid.textContent = fmt(virtPaid);
  if (labelTotalToPay) labelTotalToPay.textContent = fmt(totalToPay);

  if (change > 0) {
    summary.classList.add('bg-green-50', 'dark:bg-green-900/20', 'border-green-200', 'dark:border-green-800');
    summary.classList.remove('bg-slate-50', 'dark:bg-slate-700/50', 'border-slate-200', 'dark:border-slate-600');
    balanceLabel.textContent = '🟢 Cambio:';
    balanceLabel.className = 'col-balance-label text-green-700 dark:text-green-400 font-bold';
    balanceAmount.textContent = fmt(change);
    balanceAmount.className = 'col-balance-amount text-green-700 dark:text-green-400 font-black text-lg';
  } else {
    summary.classList.remove('bg-green-50', 'dark:bg-green-900/20', 'border-green-200', 'dark:border-green-800');
    summary.classList.add('bg-slate-50', 'dark:bg-slate-700/50', 'border-slate-200', 'dark:border-slate-600');
    balanceLabel.textContent = remaining > 0 ? '🔴 Pendiente:' : '✅ Cubierto';
    balanceLabel.className = 'col-balance-label text-slate-600 dark:text-slate-400';
    balanceAmount.textContent = remaining > 0 ? fmt(remaining) : fmt(0);
    balanceAmount.className = 'col-balance-amount font-bold text-amber-600';
  }

  if (virtPaid >= totalToPay) {
    btnConfirm.disabled = false;
    btnConfirm.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-400', 'cursor-not-allowed');
    btnConfirm.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white', 'shadow-lg', 'shadow-green-600/30', 'active:scale-[0.98]');
  } else {
    btnConfirm.disabled = true;
    btnConfirm.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-400', 'cursor-not-allowed');
    btnConfirm.classList.remove('bg-green-600', 'hover:bg-green-700', 'text-white', 'shadow-lg', 'shadow-green-600/30', 'active:scale-[0.98]');
  }
};

// ── Ticket de Éxito ────────────────────────────────────────────────────────
export const renderTicketSuccess = (folio, total) => {
  const overlay = document.getElementById('payment-modal');
  if (!overlay) return;

  overlay.innerHTML = '';
  const clon = cloneTemplate('tpl-cashier-ticket');
  clon.querySelector('.col-ticket-folio').textContent = folio;
  clon.querySelector('.col-ticket-total').textContent = fmt(total);
  overlay.appendChild(clon);
};

// ── Modal Corte Z ──────────────────────────────────────────────────────────
export const renderCorteModal = (corte) => {
  if (!corte) return;
  document.getElementById('corte-modal')?.remove();

  const clon = cloneTemplate('tpl-cashier-corte');

  clon.querySelector('.col-corte-date').textContent = corte.date || '';
  clon.querySelector('.col-corte-tickets').textContent = corte.totalTickets ?? '—';
  clon.querySelector('.col-corte-total').textContent = fmt(corte.grandTotal);
  clon.querySelector('.col-corte-tips').textContent = fmt(corte.grandTips);

  const tbody = clon.querySelector('#corte-body');
  if (!corte.byMethod?.length) {
    tbody.appendChild(cloneTemplate('tpl-cashier-corte-empty'));
  } else {
    corte.byMethod.forEach(m => {
      const rowClon = cloneTemplate('tpl-cashier-corte-row');
      rowClon.querySelector('.col-method').textContent = _uiConfig.methodLabel[m.method] || m.method;
      rowClon.querySelector('.col-transactions').textContent = m.transactions;
      rowClon.querySelector('.col-total-collected').textContent = fmt(m.totalCollected);
      rowClon.querySelector('.col-total-tips').textContent = fmt(m.totalTips);
      tbody.appendChild(rowClon);
    });
  }

  // El template tpl-cashier-corte ya incluye el overlay completo
  const el = document.createElement('div');
  el.id = 'corte-modal';
  el.appendChild(clon);
  document.body.appendChild(el);
};