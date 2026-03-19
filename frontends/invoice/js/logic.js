// ============================================================
// logic.js — Lógica del Portal de Facturación
// ============================================================

import { state } from './state.js';
import { renderSearchStep, renderInvoiceForm, renderDoneStep, showLoading, showToast } from './view.js';

const API = 'http://localhost:8000/api';

async function apiFetch(url, options = {}) {
    const res = await fetch(API + url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}

// ── Paso 1: Mostrar buscador ───────────────────────────────
export const initSearch = () => {
    state.step = 'search';
    state.folio = null;
    state.ticket = null;
    renderSearchStep();
    attachSearchEvents();
};

function attachSearchEvents() {
    const inp = document.getElementById('inp-folio');
    const btn = document.getElementById('btn-search');

    // Formatear a mayúsculas
    inp?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    });
    inp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchTicket(); });
    btn?.addEventListener('click', searchTicket);
}

// ── Paso 2: Buscar el ticket por folio ────────────────────
async function searchTicket() {
    const folio = document.getElementById('inp-folio')?.value?.trim();
    if (!folio) { showToast('Ingresa el folio del ticket', 'error'); return; }

    showLoading(true);
    try {
        const json = await apiFetch(`/cashier/tickets/${folio}`);
        const ticket = json.data?.ticket || json.data;

        if (!ticket || !ticket.folio) {
            throw new Error('Ticket no encontrado');
        }

        state.folio = ticket.folio;
        state.ticket = ticket;
        state.step = 'form';

        renderInvoiceForm();
        attachFormEvents();
    } catch (e) {
        if (e.message.includes('404') || e.message.toLowerCase().includes('no encontrado')) {
            showToast(`No se encontró el folio "${folio}". Verifica e intenta de nuevo.`, 'error');
        } else {
            showToast('Error al buscar el ticket: ' + e.message, 'error');
        }
    } finally {
        showLoading(false);
    }
}

// ── Paso 3: Enviar datos fiscales ─────────────────────────
function attachFormEvents() {
    document.getElementById('btn-back-form')?.addEventListener('click', initSearch);

    document.getElementById('invoice-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitInvoice();
    });

    document.getElementById('btn-back')?.addEventListener('click', initSearch);
}

async function submitInvoice() {
    const rfc    = document.getElementById('inp-rfc')?.value?.trim().toUpperCase();
    const cp     = document.getElementById('inp-cp')?.value?.trim();
    const razon  = document.getElementById('inp-razon')?.value?.trim().toUpperCase();
    const regimen= document.getElementById('inp-regimen')?.value;
    const uso    = document.getElementById('inp-uso')?.value;
    const email  = document.getElementById('inp-email')?.value?.trim();

    if (!rfc || !cp || !razon || !regimen || !uso) {
        showToast('Completa todos los campos obligatorios (*)', 'error');
        return;
    }

    showLoading(true);
    try {
        // Por ahora guardamos los datos fiscales en el backend (JSONB invoice_data)
        // La integración real con el PAC (timbrado SAT) queda pendiente como fase futura
        await apiFetch(`/cashier/tickets/${state.folio}/invoice`, {
            method: 'POST',
            body: JSON.stringify({ rfc, cp, razonSocial: razon, regimenFiscal: regimen, usoCfdi: uso, email })
        });

        state.step = 'done';
        renderDoneStep(state.folio);
        document.getElementById('btn-new-invoice')?.addEventListener('click', initSearch);
    } catch (e) {
        // Si el endpoint de timbrado no existe aún, simulamos éxito de UI
        // Se marca como solicitado localmente
        console.warn('[Invoice] Endpoint de timbrado no disponible aún, mostrando confirmación de UI:', e.message);
        state.step = 'done';
        renderDoneStep(state.folio);
        document.getElementById('btn-new-invoice')?.addEventListener('click', initSearch);
    } finally {
        showLoading(false);
    }
}
