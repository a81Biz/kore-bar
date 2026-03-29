// ============================================================
// cashier/js/ticket-print.js
// Módulo: Impresión de tickets térmicos 80mm
// Patrón: Módulo monolítico de 7 secciones
// ============================================================

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showErrorModal } from '/shared/js/ui.js';

// ==========================================================================
// 2. ESTADO PRIVADO Y CONFIGURACIÓN
// ==========================================================================
const _dom = {};
const _data = { currentTicket: null };

const _paymentLabels = {
    'CASH': 'Efectivo',
    'CARD': 'Tarjeta',
    'TRANSFER': 'Transferencia',
    'MIXED': 'Mixto'
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const _cacheDOM = () => {
    _dom.container = document.querySelector('#ticket-print-container');
    _dom.businessName = document.querySelector('#print-business-name');
    _dom.rfc = document.querySelector('#print-rfc');
    _dom.address = document.querySelector('#print-address');
    _dom.folio = document.querySelector('#print-folio');
    _dom.date = document.querySelector('#print-date');
    _dom.table = document.querySelector('#print-table');
    _dom.zone = document.querySelector('#print-zone');
    _dom.waiter = document.querySelector('#print-waiter');
    _dom.items = document.querySelector('#print-items');
    _dom.subtotal = document.querySelector('#print-subtotal');
    _dom.tax = document.querySelector('#print-tax');
    _dom.tip = document.querySelector('#print-tip');
    _dom.total = document.querySelector('#print-total');
    _dom.paymentMethod = document.querySelector('#print-payment-method');
    _dom.footerMessage = document.querySelector('#print-footer-message');
    _dom.invoiceStatus = document.querySelector('#print-invoice-status');
};

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO
// ==========================================================================
const _formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `$${num.toFixed(2)}`;
};

const _hydrateTicket = (data) => {
    const { header, items, totals, footer } = data;

    // Header
    _dom.businessName.textContent = header.business_name;
    _dom.rfc.textContent = `RFC: ${header.rfc}`;
    _dom.address.textContent = header.address;
    _dom.folio.textContent = header.folio;
    _dom.date.textContent = header.date;
    _dom.table.textContent = header.table_code || '—';
    _dom.zone.textContent = header.zone_name || '—';
    _dom.waiter.textContent = header.waiter_name || '—';

    // Items
    _dom.items.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;';
        row.innerHTML = `
            <span style="flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.dish_name}</span>
            <span style="flex:0.5;text-align:center;">${item.quantity}</span>
            <span style="flex:1;text-align:right;">${_formatCurrency(item.unit_price)}</span>
            <span style="flex:1;text-align:right;">${_formatCurrency(item.line_total)}</span>
        `;
        _dom.items.appendChild(row);
    });

    // Totales
    _dom.subtotal.textContent = _formatCurrency(totals.subtotal);
    _dom.tax.textContent = _formatCurrency(totals.tax);
    _dom.tip.textContent = _formatCurrency(totals.tip);
    _dom.total.textContent = _formatCurrency(totals.total);
    _dom.paymentMethod.textContent = _paymentLabels[totals.payment_method] || totals.payment_method;

    // Footer
    _dom.footerMessage.textContent = footer.message;
    _dom.invoiceStatus.textContent = footer.is_invoiced ? '✓ FACTURADO' : 'Para facturar visite: facturacion.korebar.mx';
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS
// ==========================================================================
const _fetchAndPrint = async (folio) => {
    try {
        const endpoint = ENDPOINTS.cashier.get.ticketPrint.replace(':folio', folio);
        const res = await fetchData(endpoint);

        if (!res.success || !res.data?.result?.data) {
            showErrorModal('No se encontraron datos del ticket.');
            return;
        }

        _data.currentTicket = res.data.result.data;
        _hydrateTicket(res.data.result.data);

        // Mostrar el contenedor, imprimir y volver a ocultar
        _dom.container.classList.remove('hidden');

        // Esperar un tick para que el DOM se actualice
        setTimeout(() => {
            window.print();
            _dom.container.classList.add('hidden');
        }, 100);

    } catch (error) {
        showErrorModal(error.message);
    }
};

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
// Los eventos se delegan desde el módulo padre (cashier logic.js)
// que invoca printTicket(folio) tras un cobro exitoso

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const TicketPrinter = {
    init: () => {
        _cacheDOM();
    },

    /**
     * Imprime un ticket por su folio
     * @param {string} folio — Ej: 'TKT-20260327-0001'
     */
    print: async (folio) => {
        if (!folio || !/^TKT-/.test(folio)) {
            showErrorModal('Folio de ticket inválido.');
            return;
        }
        await _fetchAndPrint(folio);
    },

    /**
     * Re-imprime el último ticket procesado sin nueva consulta HTTP
     */
    reprint: () => {
        if (!_data.currentTicket) {
            showErrorModal('No hay ticket en memoria para reimprimir.');
            return;
        }
        _hydrateTicket(_data.currentTicket);
        _dom.container.classList.remove('hidden');
        setTimeout(() => {
            window.print();
            _dom.container.classList.add('hidden');
        }, 100);
    }
};
