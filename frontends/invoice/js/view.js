// ============================================================
// invoice/js/view.js — Renderizado del Portal de Facturación
// Usa exclusivamente <template> + cloneNode(true).
// Sin lógica de negocio ni llamadas a API.
// ============================================================

import { state } from './state.js';

const app = document.getElementById('app');

const fmt     = (n)   => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

const cloneTemplate = (id) => {
    const tpl = document.getElementById(id);
    if (!tpl) throw new Error(`[View] Template no encontrado: ${id}`);
    return tpl.content.cloneNode(true);
};

// ── Spinner ────────────────────────────────────────────────────────────────
export const showLoading = (show) => {
    document.getElementById('loading-overlay')?.classList.toggle('hidden', !show);
};

// ── Toast ──────────────────────────────────────────────────────────────────
export const showToast = (msg, type = 'info') => {
    document.getElementById('toast')?.remove();

    const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-indigo-600' };
    const icons  = { success: 'check_circle', error: 'error',      info: 'info'          };

    const el = document.createElement('div');
    el.id        = 'toast';
    el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-white font-semibold shadow-2xl ${colors[type]} animate-slide-up`;

    // ✅ textContent en ambos spans — sin interpolación de datos externos
    const iconSpan = document.createElement('span');
    iconSpan.className   = 'material-symbols-outlined';
    iconSpan.textContent = icons[type];

    const msgSpan = document.createElement('span');
    msgSpan.textContent = msg;

    el.appendChild(iconSpan);
    el.appendChild(msgSpan);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
};

// ── Paso 1: Buscador de folio ──────────────────────────────────────────────
export const renderSearchStep = () => {
    app.innerHTML = '';
    app.appendChild(cloneTemplate('tpl-invoice-search'));
};

// ── Paso 2a: Ticket ya facturado ───────────────────────────────────────────
export const renderAlreadyInvoiced = (folio) => {
    app.innerHTML = '';
    const clon = cloneTemplate('tpl-invoice-already-invoiced');
    // ✅ folio viene de la API — se inyecta con textContent
    clon.querySelector('.col-folio').textContent = folio;
    app.appendChild(clon);
};

// ── Paso 2b: Formulario fiscal + resumen del ticket ────────────────────────
export const renderInvoiceForm = () => {
    const { ticket } = state;
    if (!ticket) return;

    app.innerHTML = '';
    const clon = cloneTemplate('tpl-invoice-form');

    // Encabezado del resumen
    clon.querySelector('.col-folio').textContent    = ticket.folio;
    clon.querySelector('.col-date').textContent     = fmtDate(ticket.createdAt);
    clon.querySelector('.col-subtotal').textContent = fmt(ticket.subtotal);
    clon.querySelector('.col-tax').textContent      = fmt(ticket.tax);
    clon.querySelector('.col-total').textContent    = fmt(ticket.total);

    // Propina: solo visible si el ticket la incluye
    if (ticket.tipTotal > 0) {
        const tipRow = clon.querySelector('.col-tip-row');
        tipRow.classList.remove('hidden');
        clon.querySelector('.col-tip').textContent = fmt(ticket.tipTotal);
    }

    // Filas de items — ✅ cada valor con textContent, sin interpolación
    const tbody = clon.querySelector('#ticket-items');
    (ticket.items || []).forEach(item => {
        const rowClon = cloneTemplate('tpl-invoice-item-row');
        rowClon.querySelector('.col-name').textContent     = item.name;
        rowClon.querySelector('.col-qty').textContent      = item.quantity;
        rowClon.querySelector('.col-subtotal').textContent = fmt(item.subtotal);
        tbody.appendChild(rowClon);
    });

    app.appendChild(clon);
};

// ── Paso 3: Confirmación ───────────────────────────────────────────────────
export const renderDoneStep = (folio) => {
    app.innerHTML = '';
    const clon = cloneTemplate('tpl-invoice-done');
    // ✅ folio viene de la API — se inyecta con textContent
    clon.querySelector('.col-folio').textContent = folio;
    app.appendChild(clon);
};
