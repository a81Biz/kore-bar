// ============================================================
// invoice/js/logic.js — Lógica del Portal de Facturación
// ============================================================
//
// ✅ Usa fetchData/postData de http.client.js en lugar de fetch() directo.
// ✅ Usa ENDPOINTS en lugar de URLs hardcodeadas.
// ✅ No silencia errores reales — el usuario siempre sabe qué pasó.

import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { state } from './state.js';
import {
    renderSearchStep, renderInvoiceForm, renderAlreadyInvoiced,
    renderDoneStep, showLoading, showToast
} from './view.js';

// ── Paso 1: Mostrar buscador de folio ──────────────────────────────────────
export const initSearch = () => {
    state.step   = 'search';
    state.folio  = null;
    state.ticket = null;
    renderSearchStep();
    attachSearchEvents();
};

function attachSearchEvents() {
    const inp = document.getElementById('inp-folio');
    const btn = document.getElementById('btn-search');

    // Forzar mayúsculas y solo caracteres válidos en folios
    inp?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    });
    inp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchTicket(); });
    btn?.addEventListener('click', searchTicket);
}

// ── Paso 2: Buscar ticket por folio ───────────────────────────────────────
async function searchTicket() {
    const folio = document.getElementById('inp-folio')?.value?.trim();
    if (!folio) { showToast('Ingresa el folio del ticket', 'error'); return; }

    showLoading(true);
    try {
        // Reutiliza el endpoint de caja: GET /cashier/tickets/:folio
        const json   = await fetchData(ENDPOINTS.cashier.get.ticket, { folio });
        const ticket = json.data?.ticket || json.data;

        if (!ticket?.folio) throw new Error('Ticket no encontrado');

        state.folio  = ticket.folio;
        state.ticket = ticket;
        state.step   = 'form';

        // Si ya fue facturado, mostramos la pantalla de advertencia
        if (ticket.isInvoiced) {
            renderAlreadyInvoiced(ticket.folio);
            document.getElementById('btn-back')?.addEventListener('click', initSearch);
            return;
        }

        renderInvoiceForm();
        attachFormEvents();
    } catch (e) {
        // El http.client ya extrae el mensaje de jsonResponse.error
        const isNotFound = e.message?.includes('404') || e.message?.toLowerCase().includes('no encontrado');
        const msg = isNotFound
            ? `No se encontró el folio "${folio}". Verifica e intenta de nuevo.`
            : `Error al buscar el ticket: ${e.message}`;
        showToast(msg, 'error');
    } finally {
        showLoading(false);
    }
}

// ── Paso 3: Formulario fiscal ─────────────────────────────────────────────
function attachFormEvents() {
    document.getElementById('btn-back-form')?.addEventListener('click', initSearch);
    document.getElementById('invoice-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitInvoice();
    });
}

async function submitInvoice() {
    const rfc     = document.getElementById('inp-rfc')?.value?.trim().toUpperCase();
    const cp      = document.getElementById('inp-cp')?.value?.trim();
    const razon   = document.getElementById('inp-razon')?.value?.trim().toUpperCase();
    const regimen = document.getElementById('inp-regimen')?.value;
    const uso     = document.getElementById('inp-uso')?.value;
    const email   = document.getElementById('inp-email')?.value?.trim();

    if (!rfc || !cp || !razon || !regimen || !uso) {
        showToast('Completa todos los campos obligatorios (*)', 'error');
        return;
    }

    showLoading(true);
    try {
        await postData(
            ENDPOINTS.invoice.post.request,
            { rfc, cp, razonSocial: razon, regimenFiscal: regimen, usoCfdi: uso, email },
            { folio: state.folio }
        );

        state.step = 'done';
        renderDoneStep(state.folio);
        document.getElementById('btn-new-invoice')?.addEventListener('click', initSearch);
    } catch (e) {
        // ✅ No silenciamos el error — siempre informamos al usuario
        showToast('No se pudo enviar la solicitud: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}
