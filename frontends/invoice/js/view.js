// ============================================================
// view.js — Vistas del Portal de Facturación
// ============================================================

import { state } from './state.js';

const app = document.getElementById('app');
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export const showLoading = (show) => {
    document.getElementById('loading-overlay')?.classList.toggle('hidden', !show);
};

export const showToast = (msg, type = 'info') => {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();
    const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-indigo-600' };
    const el = document.createElement('div');
    el.id = 'toast';
    el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-white font-semibold shadow-2xl ${colors[type]} animate-slide-up`;
    el.innerHTML = `<span class="material-symbols-outlined">${type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info'}</span><span>${msg}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
};

// ── Paso 1: Formulario de búsqueda por folio ──────────────
export const renderSearchStep = () => {
    app.innerHTML = `
    <div class="animate-fade-in">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
          <span class="material-symbols-outlined text-3xl text-indigo-600">search</span>
        </div>
        <h2 class="text-2xl font-black text-slate-900">Busca tu Ticket</h2>
        <p class="text-slate-500 mt-2">Ingresa el folio impreso en tu ticket de compra</p>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <label class="block text-sm font-bold text-slate-700 mb-2">Folio del Ticket</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">confirmation_number</span>
          <input id="inp-folio" type="text"
            placeholder="Ej. TKT-20260312-0001"
            class="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-slate-200 text-slate-900 font-bold text-lg uppercase tracking-widest focus:ring-0 focus:border-indigo-500 outline-none transition-colors"
            autocomplete="off" />
        </div>
        <button id="btn-search"
          class="mt-5 w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-lg rounded-xl shadow-lg shadow-indigo-200 transition-all">
          <span class="material-symbols-outlined">search</span>
          Buscar Ticket
        </button>
      </div>

      <div class="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-sm text-amber-800">
        <span class="material-symbols-outlined text-amber-600 flex-shrink-0">info</span>
        <p>El folio aparece en la parte inferior de tu ticket de papel, con el formato <strong>TKT-YYYYMMDD-XXXX</strong>.</p>
      </div>
    </div>`;
};

// ── Paso 2: Formulario fiscal + resumen del ticket ─────────
export const renderInvoiceForm = () => {
    const { ticket } = state;
    if (!ticket) return;

    if (ticket.isInvoiced) {
        app.innerHTML = `
        <div class="text-center py-16 animate-fade-in">
          <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl text-amber-600">warning</span>
          </div>
          <h2 class="text-xl font-black text-slate-900">Este ticket ya fue facturado</h2>
          <p class="text-slate-500 mt-2">El folio <strong>${ticket.folio}</strong> ya tiene un CFDI generado.</p>
          <button id="btn-back" class="mt-6 px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 transition-colors">
            ← Buscar otro folio
          </button>
        </div>`;
        document.getElementById('btn-back')?.addEventListener('click', () => {
            import('./logic.js').then(m => m.initSearch());
        });
        return;
    }

    app.innerHTML = `
    <div class="animate-fade-in space-y-6">

      <!-- Resumen del Ticket -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <span class="material-symbols-outlined text-indigo-600">receipt_long</span>
          <div>
            <h3 class="font-bold text-slate-900">Resumen del Ticket</h3>
            <p class="text-xs text-slate-500">Folio: <span class="font-mono font-bold text-indigo-600">${ticket.folio}</span> · ${fmtDate(ticket.createdAt)}</p>
          </div>
        </div>
        <div class="px-6 py-4 max-h-52 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="text-xs uppercase text-slate-400">
              <tr>
                <th class="pb-2 text-left">Producto</th>
                <th class="pb-2 text-right w-12">Cant.</th>
                <th class="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              ${ticket.items.map(i => `
                <tr>
                  <td class="py-2 font-medium text-slate-800">${i.name}</td>
                  <td class="py-2 text-right text-slate-500">${i.quantity}</td>
                  <td class="py-2 text-right font-bold text-slate-900">${fmt(i.subtotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-1 text-sm">
          <div class="flex justify-between text-slate-600"><span>Subtotal:</span><span>${fmt(ticket.subtotal)}</span></div>
          <div class="flex justify-between text-slate-600"><span>IVA (16%):</span><span>${fmt(ticket.tax)}</span></div>
          ${ticket.tipTotal > 0 ? `<div class="flex justify-between text-slate-600"><span>Propina:</span><span>${fmt(ticket.tipTotal)}</span></div>` : ''}
          <div class="flex justify-between font-black text-base text-indigo-600 pt-1 border-t border-slate-200"><span>Total:</span><span>${fmt(ticket.total)}</span></div>
        </div>
      </div>

      <!-- Formulario Fiscal -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 class="font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="material-symbols-outlined text-indigo-600">assignment</span>
          Datos Fiscales del Receptor
        </h3>
        <form id="invoice-form" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">RFC *</label>
              <input id="inp-rfc" required maxlength="13" placeholder="XAXX010101000"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Código Postal Fiscal *</label>
              <input id="inp-cp" required maxlength="5" placeholder="00000" inputmode="numeric"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Razón Social / Nombre *</label>
            <input id="inp-razon" required placeholder="Nombre o Razón Social completa"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-semibold uppercase focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Régimen Fiscal *</label>
            <select id="inp-regimen"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all appearance-none">
              <option value="">— Seleccionar régimen —</option>
              <option value="601">601 - General de Ley Personas Morales</option>
              <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
              <option value="605">605 - Sueldos y Salarios e Ingresos Asimilados</option>
              <option value="606">606 - Arrendamiento</option>
              <option value="612">612 - Personas Físicas con Act. Empresariales</option>
              <option value="616">616 - Sin obligaciones fiscales</option>
              <option value="621">621 - Incorporación Fiscal</option>
              <option value="625">625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas</option>
              <option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Uso de CFDI *</label>
            <select id="inp-uso"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all appearance-none">
              <option value="">— Seleccionar uso —</option>
              <option value="G01">G01 - Adquisición de mercancias</option>
              <option value="G03">G03 - Gastos en general</option>
              <option value="D04">D04 - Donativos</option>
              <option value="S01">S01 - Sin efectos fiscales</option>
              <option value="CP01">CP01 - Pagos</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Correo Electrónico (para envío XML/PDF)</label>
            <input id="inp-email" type="email" placeholder="ejemplo@correo.com"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all" />
          </div>

          <div class="flex gap-3 pt-2">
            <button type="button" id="btn-back-form"
              class="px-5 py-3 rounded-xl font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
              ← Volver
            </button>
            <button type="submit"
              class="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all">
              <span class="material-symbols-outlined">send</span>
              Solicitar Factura
            </button>
          </div>
        </form>
      </div>
    </div>`;
};

// ── Paso 3: Confirmación ──────────────────────────────────
export const renderDoneStep = (folio) => {
    app.innerHTML = `
    <div class="text-center py-10 animate-fade-in">
      <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span class="material-symbols-outlined text-4xl text-green-600">task_alt</span>
      </div>
      <h2 class="text-2xl font-black text-slate-900 mb-2">¡Solicitud Enviada!</h2>
      <p class="text-slate-500 mb-6">Tu CFDI para el ticket <strong class="text-indigo-600 font-mono">${folio}</strong> ha sido registrado.</p>
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-left text-sm text-indigo-800 mb-6 space-y-2">
        <p class="flex items-start gap-2"><span class="material-symbols-outlined text-base">mail</span>Recibirás el XML y PDF por correo electrónico en los próximos minutos.</p>
        <p class="flex items-start gap-2"><span class="material-symbols-outlined text-base">info</span>Si no recibes el correo, contacta a la caja del restaurante con tu folio.</p>
      </div>
      <button id="btn-new-invoice"
        class="px-8 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 transition-colors">
        Facturar otro ticket
      </button>
    </div>`;
};
