// ============================================================
// view.js — Funciones puras de renderizado del Módulo de Caja
// Sin lógica de negocio ni llamadas a API.
// ============================================================

import { state } from './state.js';

const app = document.getElementById('app');

// ── Helpers de formato ─────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtTime = (iso) => {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
    return diff < 1 ? 'Ahora' : `Hace ${diff} min`;
};

// ── Toast ──────────────────────────────────────────────────
export const showToast = (msg, type = 'success') => {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
    const icons  = { success: 'check_circle', error: 'error', info: 'info' };

    const el = document.createElement('div');
    el.id = 'toast';
    el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-white font-semibold shadow-2xl ${colors[type]} animate-slide-up`;
    el.innerHTML = `<span class="material-symbols-outlined">${icons[type]}</span><span>${msg}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
};

// ── Spinner ────────────────────────────────────────────────
export const showLoading = (show) => {
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.toggle('hidden', !show);
};

// ── Screen 1: Login Dinámico ───────────────────────────────
export const renderLoginScreen = (employees = []) => {
    app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div class="w-full max-w-sm">

        <!-- Logo / Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/30 mb-4">
            <span class="material-symbols-outlined text-3xl text-white">point_of_sale</span>
          </div>
          <h1 class="text-2xl font-black text-white tracking-tight">Kore Bar — Caja</h1>
          <p class="text-slate-400 text-sm mt-1">Selecciona tu nombre e ingresa tu PIN</p>
        </div>

        <!-- Card -->
        <div class="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-6 space-y-5">

          <!-- Selector de empleado -->
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Empleado</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">person</span>
              <select id="sel-employee"
                class="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none appearance-none transition-all">
                <option value="">— Seleccionar empleado —</option>
                ${employees.map(e => `
                  <option value="${e.employee_number}">${e.first_name} ${e.last_name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- PIN -->
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">PIN de acceso</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">lock</span>
              <input id="inp-pin" type="password" maxlength="6" placeholder="••••••"
                class="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white font-bold text-lg tracking-[0.3em] focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                autocomplete="off" inputmode="numeric" />
            </div>
          </div>

          <!-- Accesos rápidos de PIN -->
          <div class="grid grid-cols-3 gap-2">
            ${[1,2,3,4,5,6,7,8,9,'⌫',0,'OK'].map(k => `
              <button data-key="${k}"
                class="pin-btn py-4 rounded-xl font-bold text-lg transition-all
                  ${k === 'OK'
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-400 col-span-1'
                    : k === '⌫'
                      ? 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                      : 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600'}"
              >${k}</button>
            `).join('')}
          </div>

          <!-- Botón de ingreso -->
          <button id="btn-login"
            class="w-full flex items-center justify-center gap-3 py-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-white font-bold text-lg rounded-xl shadow-lg shadow-amber-500/30 transition-all">
            <span class="material-symbols-outlined">login</span>
            Ingresar a Caja
          </button>
        </div>

        <p class="text-center text-slate-600 text-xs mt-6">Kore Bar POS · v2.0 · Cashier Module</p>
      </div>
    </div>`;
};

// ── Screen 2: Tablero de Mesas ─────────────────────────────
export const renderBoard = () => {
    const { board, selectedTable, cashier } = state;

    app.innerHTML = `
    <div class="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col">

      <!-- Header -->
      <header class="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
            <span class="material-symbols-outlined text-white text-xl">point_of_sale</span>
          </div>
          <div>
            <h1 class="font-black text-slate-900 dark:text-white text-lg leading-none">Kore Bar — Caja</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400">${cashier ? `${cashier.firstName} ${cashier.lastName}` : ''}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-corte" title="Corte de Caja"
            class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-amber-50 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600">
            <span class="material-symbols-outlined text-base">account_balance_wallet</span>
            <span class="hidden sm:inline">Corte Z</span>
          </button>
          <button id="btn-logout" title="Cerrar sesión"
            class="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 dark:border-red-800">
            <span class="material-symbols-outlined text-base">logout</span>
          </button>
        </div>
      </header>

      <!-- Main Content (2 columnas) -->
      <main class="flex flex-col lg:flex-row flex-1 gap-0 overflow-hidden h-[calc(100vh-64px)]">

        <!-- columna izquierda: lista de mesas -->
        <aside class="w-full lg:w-96 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 class="font-bold text-slate-900 dark:text-white">Esperando Pago</h2>
            <span id="badge-count"
              class="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full">
              ${board.length} ${board.length === 1 ? 'mesa' : 'mesas'}
            </span>
          </div>

          <div id="board-list" class="flex-1 overflow-y-auto p-4 space-y-3">
            ${board.length === 0 ? `
              <div class="flex flex-col items-center justify-center h-full py-16 text-center">
                <span class="material-symbols-outlined text-5xl text-slate-300 mb-3">table_restaurant</span>
                <p class="text-slate-500 font-medium">Sin mesas pendientes</p>
                <p class="text-slate-400 text-sm mt-1">Las mesas aparecen aquí cuando el mesero solicita la cuenta</p>
              </div>
            ` : board.map(t => `
              <button data-table="${t.tableCode}"
                class="board-item w-full text-left p-4 rounded-xl border-2 transition-all shadow-sm
                  ${selectedTable?.tableCode === t.tableCode
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-transparent bg-slate-50 dark:bg-slate-700 hover:border-amber-300'}">
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                    ${selectedTable?.tableCode === t.tableCode ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-600'}">
                    <span class="material-symbols-outlined ${selectedTable?.tableCode === t.tableCode ? 'text-white' : 'text-slate-500'}">
                      table_restaurant
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-900 dark:text-white truncate">Mesa ${t.tableCode}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${t.waiterName} · ${t.zoneName}</p>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="font-black text-slate-900 dark:text-white">${fmt(t.total)}</p>
                    <p class="text-[11px] text-amber-600 dark:text-amber-400 font-medium">${fmtTime(t.waitingSince)}</p>
                  </div>
                </div>
              </button>
            `).join('')}
          </div>
        </aside>

        <!-- columna derecha: detalle de la mesa seleccionada -->
        <section id="detail-panel" class="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
          ${selectedTable ? renderTableDetail() : `
            <div class="flex-1 flex flex-col items-center justify-center text-center p-8">
              <span class="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 mb-4">touch_app</span>
              <h3 class="text-xl font-bold text-slate-400 dark:text-slate-600">Selecciona una mesa</h3>
              <p class="text-slate-400 dark:text-slate-600 text-sm mt-2">Haz clic en una mesa de la lista para ver su detalle</p>
            </div>
          `}
        </section>
      </main>
    </div>`;
};

// ── Detalle de mesa dentro del panel derecho ───────────────
export const renderTableDetail = () => {
    const { selectedTable, orderItems } = state;
    if (!selectedTable) return '';

    return `
    <div class="flex flex-col h-full">
      <!-- Header del detalle -->
      <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white">Mesa ${selectedTable.tableCode} — ${selectedTable.zoneName}</h3>
          <p class="text-sm text-slate-500">Mesero: ${selectedTable.waiterName} · ${fmtTime(selectedTable.waitingSince)}</p>
        </div>
        <button id="btn-print-pre" title="Imprimir pre-cuenta"
          class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
          <span class="material-symbols-outlined">print</span>
        </button>
      </div>

      <!-- Items -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <table class="w-full">
          <thead>
            <tr class="text-xs uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th class="pb-3 text-left w-10">Cant.</th>
              <th class="pb-3 text-left">Producto</th>
              <th class="pb-3 text-right">Unitario</th>
              <th class="pb-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50 dark:divide-slate-800">
            ${orderItems.length === 0 ? `
              <tr><td colspan="4" class="py-8 text-center text-slate-400">Cargando consumo...</td></tr>
            ` : orderItems.map(item => `
              <tr>
                <td class="py-3 font-bold text-amber-600">${item.quantity}x</td>
                <td class="py-3 font-semibold text-slate-800 dark:text-slate-100">${item.name}</td>
                <td class="py-3 text-right text-slate-500 dark:text-slate-400">${fmt(item.unitPrice)}</td>
                <td class="py-3 text-right font-bold text-slate-900 dark:text-white">${fmt(item.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer con total y botón de pago -->
      <div class="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 px-6 py-5">
        <div class="flex items-center justify-between mb-4">
          <div class="space-y-1 text-sm text-slate-500">
            <div class="flex justify-between gap-8">
              <span>Subtotal (sin IVA):</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">${fmt(selectedTable.total / 1.16)}</span>
            </div>
            <div class="flex justify-between gap-8">
              <span>IVA (16%):</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">${fmt(selectedTable.total - selectedTable.total / 1.16)}</span>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">Total a Cobrar</p>
            <p class="text-4xl font-black text-amber-500">${fmt(selectedTable.total)}</p>
          </div>
        </div>
        <button id="btn-open-payment"
          class="w-full flex items-center justify-center gap-3 py-4 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-bold text-xl rounded-xl shadow-lg shadow-green-600/30 transition-all">
          <span class="material-symbols-outlined text-2xl">payments</span>
          Procesar Pago
        </button>
      </div>
    </div>`;
};

// ── Modal: Procesamiento de Pago ───────────────────────────
export const renderPaymentModal = () => {
    const { selectedTable, paymentLines, tip } = state;
    if (!selectedTable) return;

    const paid = paymentLines.reduce((s, l) => s + l.amount, 0);
    const remaining = Math.max(0, selectedTable.total - paid);
    const change = Math.max(0, paid - selectedTable.total);

    const modal = document.getElementById('payment-modal');
    if (!modal) {
        const m = document.createElement('div');
        m.id = 'payment-modal';
        m.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm';
        document.body.appendChild(m);
    }

    document.getElementById('payment-modal').innerHTML = `
    <div class="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">

      <!-- Header modal -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
            <span class="material-symbols-outlined text-green-600 dark:text-green-400">payments</span>
          </div>
          <div>
            <h2 class="font-black text-slate-900 dark:text-white">Procesar Pago</h2>
            <p class="text-xs text-slate-500">Mesa ${selectedTable.tableCode} · ${fmt(selectedTable.total)}</p>
          </div>
        </div>
        <button id="btn-close-payment" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
          <span class="material-symbols-outlined text-slate-500">close</span>
        </button>
      </div>

      <div class="p-6 space-y-5">

        <!-- Líneas de pago acumuladas -->
        <div id="payment-lines">
          ${paymentLines.length === 0 ? '' : paymentLines.map((l, i) => `
            <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-slate-400 text-base">${l.method === 'CASH' ? 'payments' : 'credit_card'}</span>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">${l.method === 'CASH' ? 'Efectivo' : l.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-bold text-slate-900 dark:text-white">${fmt(l.amount)}</span>
                <button data-idx="${i}" class="btn-rm-line text-red-400 hover:text-red-600 transition-colors">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Selector método + monto -->
        <div class="grid grid-cols-2 gap-3">
          <select id="sel-method"
            class="px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-amber-500 outline-none">
            <option value="CASH">💵 Efectivo</option>
            <option value="CARD">💳 Tarjeta</option>
            <option value="TRANSFER">📱 Transferencia</option>
          </select>
          <input id="inp-amount" type="number" step="0.01" min="0.01"
            placeholder="${fmt(remaining).replace('$', '')}"
            class="px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-amber-500 outline-none"
            value="${remaining > 0 ? remaining.toFixed(2) : ''}" />
        </div>

        <!-- Botones rápidos de monto -->
        <div class="grid grid-cols-4 gap-2">
          ${[100, 200, 500, 1000].map(v => `
            <button data-quick="${v}"
              class="quick-amount py-2.5 rounded-lg font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-amber-100 hover:text-amber-700 transition-all border border-transparent hover:border-amber-200">
              $${v}
            </button>
          `).join('')}
        </div>

        <button id="btn-add-line"
          class="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold text-sm hover:border-amber-400 hover:text-amber-500 transition-all flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-base">add</span>
          Agregar línea de pago
        </button>

        <!-- Propina -->
        <div class="flex items-center gap-3">
          <label class="text-sm font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Propina:</label>
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
            <input id="inp-tip" type="number" step="0.01" min="0" value="${tip || ''}"
              placeholder="0.00"
              class="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
        </div>

        <!-- Resumen -->
        <div class="rounded-xl p-4 ${change > 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : remaining > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200' : 'bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600'}">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-slate-600 dark:text-slate-400">Total cobrado:</span>
            <span class="font-bold text-slate-900 dark:text-white">${fmt(paid)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="${change > 0 ? 'text-green-700 dark:text-green-400 font-bold' : 'text-slate-600 dark:text-slate-400'}">
              ${change > 0 ? '🟢 Cambio:' : '🔴 Pendiente:'}
            </span>
            <span class="${change > 0 ? 'text-green-700 dark:text-green-400 font-black text-lg' : 'font-bold text-amber-600'}">
              ${change > 0 ? fmt(change) : fmt(remaining)}
            </span>
          </div>
        </div>
      </div>

      <!-- Footer modal -->
      <div class="px-6 pb-6">
        <button id="btn-confirm-payment"
          ${paid < selectedTable.total ? 'disabled' : ''}
          class="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-xl transition-all
            ${paid >= selectedTable.total
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30 active:scale-[0.98]'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}">
          <span class="material-symbols-outlined text-2xl">receipt_long</span>
          Confirmar y Emitir Ticket
        </button>
      </div>
    </div>`;
};

// ── Modal: Ticket Emitido ──────────────────────────────────
export const renderTicketSuccess = (folio, total) => {
    const modal = document.getElementById('payment-modal');
    if (!modal) return;
    modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 text-center p-10">
      <div class="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-5">
        <span class="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">check_circle</span>
      </div>
      <h2 class="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Pago Exitoso!</h2>
      <p class="text-slate-500 text-sm mb-6">El ticket fue emitido y la mesa queda libre.</p>
      <div class="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-6">
        <p class="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Folio del Ticket</p>
        <p class="text-2xl font-black text-amber-500 font-mono">${folio}</p>
        <p class="text-lg font-bold text-slate-900 dark:text-white mt-2">${fmt(total)}</p>
      </div>
      <p class="text-xs text-slate-400 mb-6">El cliente puede usar este folio en <strong>invoice.localhost</strong> para facturar.</p>
      <button id="btn-close-success"
        class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-all">
        Cerrar
      </button>
    </div>`;
};

// ── Modal: Corte Z ─────────────────────────────────────────
export const renderCorteModal = (corte) => {
    if (!corte) return;
    const existing = document.getElementById('corte-modal');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'corte-modal';
    el.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm';
    el.innerHTML = `
    <div class="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
            <span class="material-symbols-outlined text-blue-600">account_balance_wallet</span>
          </div>
          <div>
            <h2 class="font-black text-slate-900 dark:text-white">Corte Z</h2>
            <p class="text-xs text-slate-500">${corte.date}</p>
          </div>
        </div>
        <button id="btn-close-corte" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
          <span class="material-symbols-outlined text-slate-500">close</span>
        </button>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
            <p class="text-xs text-slate-400 uppercase tracking-widest">Tickets</p>
            <p class="text-2xl font-black text-slate-900 dark:text-white">${corte.totalTickets}</p>
          </div>
          <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
            <p class="text-xs text-amber-600 uppercase tracking-widest">Total</p>
            <p class="text-xl font-black text-amber-600">${fmt(corte.grandTotal)}</p>
          </div>
          <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
            <p class="text-xs text-green-600 uppercase tracking-widest">Propinas</p>
            <p class="text-xl font-black text-green-600">${fmt(corte.grandTips)}</p>
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-700">
              <tr class="text-xs uppercase text-slate-400">
                <th class="px-4 py-2 text-left">Método</th>
                <th class="px-4 py-2 text-right">Transacciones</th>
                <th class="px-4 py-2 text-right">Total</th>
                <th class="px-4 py-2 text-right">Propinas</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              ${corte.byMethod.length === 0 ? `<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400">Sin movimientos hoy</td></tr>` :
              corte.byMethod.map(m => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">${m.method === 'CASH' ? '💵 Efectivo' : m.method === 'CARD' ? '💳 Tarjeta' : '📱 Transferencia'}</td>
                  <td class="px-4 py-3 text-right text-slate-600 dark:text-slate-400">${m.transactions}</td>
                  <td class="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">${fmt(m.totalCollected)}</td>
                  <td class="px-4 py-3 text-right text-green-600">${fmt(m.totalTips)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
    document.body.appendChild(el);
};
