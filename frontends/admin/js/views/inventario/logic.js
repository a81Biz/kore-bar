// frontends/admin/js/views/inventario/logic.js
import { fetchData, postData, patchData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { ValidatorEngine } from '/shared/js/validationEngine.js';
import { SupplierRules } from '../../rules/inventario.rules.js';
import { showSuccessModal, showErrorModal } from '/shared/js/ui.js';

import { state } from './state.js';
import { render } from './view.js';

const _validator = new ValidatorEngine(SupplierRules);

// ── Genera HTML para imprimir el pedido en el diálogo del navegador ────────
const _printOrder = (order) => {
    const originLabels = { KITCHEN: 'Cocina', ADMIN: 'Administración', MANUAL: 'Manual' };
    const date = new Date(order.generatedAt).toLocaleDateString('es-MX', { dateStyle: 'long' });
    const total = parseFloat(order.totalAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

    const rows = (order.items || []).map(item => `
        <tr>
            <td>${originLabels[item.origin] || item.origin}</td>
            <td>${item.itemName}</td>
            <td>${item.supplierName || '—'}</td>
            <td style="text-align:right">${item.qtySuggested}</td>
            <td style="text-align:right">$${parseFloat(item.unitPrice || 0).toFixed(2)}</td>
            <td style="text-align:right">$${parseFloat(item.lineTotal || 0).toFixed(2)}</td>
        </tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Pedido de Compra — Kore Bar</title>
<style>
  body { font-family: sans-serif; margin: 2cm; color: #1e293b; }
  h1   { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-weight: 700;
       text-transform: uppercase; font-size: 10px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  .total-row td { font-weight: 800; border-top: 2px solid #cbd5e1; }
  @media print { body { margin: 1cm; } }
</style>
</head>
<body>
<h1>📋 Pedido de Compra — Kore Bar</h1>
<div class="meta">Fecha: ${date} · Total estimado: $${total} · ${(order.items || []).length} insumo(s)</div>
<table>
  <thead>
    <tr>
      <th>Origen</th><th>Insumo</th><th>Proveedor</th>
      <th style="text-align:right">Cantidad</th>
      <th style="text-align:right">Precio Unit.</th>
      <th style="text-align:right">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="5" style="text-align:right">TOTAL ESTIMADO</td>
      <td style="text-align:right">$${total}</td>
    </tr>
  </tbody>
</table>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return showErrorModal('Tu navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.', 'Error de Impresión');
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
};

export const api = {
    loadSuppliers: async () => {
        const res = await fetchData(ENDPOINTS.inventory.get.suppliers);
        state.data.suppliers = res.data?.suppliers || [];
        render.suppliers();
    },

    loadStock: async () => {
        const [resBodega, resCocina] = await Promise.all([
            fetchData(`${ENDPOINTS.inventory.get.stock}?location=LOC-BODEGA`),
            fetchData(`${ENDPOINTS.inventory.get.stock}?location=LOC-COCINA`)
        ]);
        state.data.stockBodega = resBodega.data?.stock || [];
        state.data.stockCocina = resCocina.data?.stock || [];
        render.stockBodega();
        render.stockCocina();
    },

    loadKardex: async () => {
        const params = new URLSearchParams();
        if (state.ui.kardexLocation) params.append('location', state.ui.kardexLocation);
        if (state.ui.kardexSearchQuery) params.append('item', state.ui.kardexSearchQuery);
        const qStr = params.toString();
        const res = await fetchData(`${ENDPOINTS.inventory.get.kardex}${qStr ? `?${qStr}` : ''}`);
        state.data.kardex = res.data?.kardex || [];
        render.kardex();
    },

    loadPurchaseSuggestions: async () => {
        const res = await fetchData(ENDPOINTS.admin.get.purchaseSuggestions);
        state.data.purchaseSuggestions = res.data?.orders || [];
    },

    saveSupplier: async (payload) => {
        const check = _validator.execute(payload);
        if (!check.isValid) throw new Error(check.error);

        if (state.ui.selectedSupplierCode === 'NEW' && state.data.suppliers.find(s => s.code === payload.code)) {
            throw new Error(`El código ${payload.code} ya existe en el catálogo.`);
        }

        await postData(ENDPOINTS.inventory.post.suppliers, payload);
        showSuccessModal('Proveedor registrado exitosamente.');
        await api.loadSuppliers();
    },

    saveSupplierPrice: async (payload) => {
        await postData(ENDPOINTS.inventory.post.supplierPrices, payload);
    },

    saveTransfer: async (payload) => {
        await postData(ENDPOINTS.inventory.post.transfers, payload);
        showSuccessModal('Traspaso efectuado exitosamente.');
        await api.loadStock();
        await api.loadKardex();
    },

    saveAdjustment: async (payload) => {
        await postData(ENDPOINTS.inventory.post.adjustments, payload);
        showSuccessModal('Inventario ajustado correctamente (Merma/Sobrante).');
        await api.loadStock();
        await api.loadKardex();
    },

    sendPurchaseOrder: async (orderId) => {
        await patchData(ENDPOINTS.admin.patch.sendPurchaseOrder, {}, { id: orderId });
        showSuccessModal('Pedido confirmado y registrado en el historial.', 'Pedido Confirmado');
        await api.loadPurchaseSuggestions();
        render.purchaseSuggestions();
        render.orderHistory();
    },

    addPurchaseOrderItem: async (orderId, payload) => {
        await postData(ENDPOINTS.admin.postItem.addPurchaseOrderItem, payload, { id: orderId });
    },

    removePurchaseOrderItem: async (orderId, lineId) => {
        await deleteData(ENDPOINTS.admin.deleteItem.removePurchaseOrderItem, { id: orderId, lineId });
    },

    syncPurchases: async (payload, orderId = null) => {
        const body = orderId ? { ...payload, orderId } : payload;
        await postData(ENDPOINTS.inventory.post.sync, body);
        showSuccessModal('Mercancía sincronizada correctamente en el stock de Bodega.');
        await api.loadStock();
        await api.loadKardex();
        await api.loadPurchaseSuggestions();
        render.purchaseSuggestions();
        render.orderHistory();
    }
};

export const bindEvents = () => {
    // ── Pestañas ────────────────────────────────────────────────────────────
    state.dom.tabs.suppliers.addEventListener('click', () => render.switchTab('suppliers'));

    state.dom.tabs.stock.addEventListener('click', () => {
        render.switchTab('stock');
        api.loadStock();
    });

    state.dom.tabs.kardex.addEventListener('click', async () => {
        render.switchTab('kardex');
        await Promise.all([api.loadKardex(), api.loadPurchaseSuggestions()]);
        render.orderHistory();
    });

    // ── Toggle "Ver solo sugerencias de compra" ─────────────────────────────
    if (state.dom.toggleSuggested) {
        state.dom.toggleSuggested.addEventListener('change', async (e) => {
            state.ui.showOnlySuggested = e.target.checked;
            if (e.target.checked) {
                state.dom.stockSplitGrid.classList.add('hidden');
                state.dom.purchaseOrdersPanel.classList.remove('hidden');
                try {
                    await api.loadPurchaseSuggestions();
                    render.purchaseSuggestions();
                } catch {
                    showErrorModal('No se pudieron cargar los pedidos de compra.', 'Error');
                }
            } else {
                state.dom.purchaseOrdersPanel.classList.add('hidden');
                state.dom.stockSplitGrid.classList.remove('hidden');
                render.stockBodega();
                render.stockCocina();
            }
        });
    }

    // btnConfirmOrder is hidden in admin (kitchen sends the order)

    // ── Imprimir pedido ─────────────────────────────────────────────────────
    if (state.dom.btnPrintOrder) {
        state.dom.btnPrintOrder.addEventListener('click', () => {
            const order = state.data.purchaseSuggestions.find(o => o.orderId === state.ui.activeOrderId);
            if (order) _printOrder(order);
        });
    }

    // ── Quitar insumo del pedido (delegación) ───────────────────────────────
    if (state.dom.poItemsBody) {
        state.dom.poItemsBody.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-remove-po-item');
            if (!btn) return;
            const lineId  = btn.getAttribute('data-line-id');
            const orderId = btn.getAttribute('data-order-id');
            try {
                await api.removePurchaseOrderItem(orderId, lineId);
                await api.loadPurchaseSuggestions();
                render.purchaseSuggestions();
            } catch (error) {
                showErrorModal(error.message, 'Error al Eliminar Insumo');
            }
        });
    }

    // ── Agregar insumo al pedido ────────────────────────────────────────────
    if (state.dom.formAddPoItem) {
        state.dom.formAddPoItem.addEventListener('submit', async (e) => {
            e.preventDefault();
            const itemCode     = state.dom.formAddPoItem.querySelector('#po-add-item-code').value.trim().toUpperCase();
            const supplierCode = state.dom.formAddPoItem.querySelector('#po-add-supplier-code').value.trim().toUpperCase() || null;
            const qty   = parseFloat(state.dom.formAddPoItem.querySelector('#po-add-qty').value);
            const price = parseFloat(state.dom.formAddPoItem.querySelector('#po-add-price').value) || 0;

            if (!itemCode || isNaN(qty) || qty <= 0) {
                showErrorModal('Código de insumo y cantidad son obligatorios.', 'Datos Incompletos');
                return;
            }
            if (!state.ui.activeOrderId) {
                showErrorModal('No hay pedido activo. Genera uno primero desde Cocina → Inventario.', 'Sin Pedido');
                return;
            }

            try {
                await api.addPurchaseOrderItem(state.ui.activeOrderId, {
                    itemCode, supplierCode, qtySuggested: qty, unitPrice: price, origin: 'ADMIN'
                });
                state.dom.formAddPoItem.reset();
                await api.loadPurchaseSuggestions();
                render.purchaseSuggestions();
            } catch (error) {
                showErrorModal(error.message, 'Error al Agregar Insumo');
            }
        });
    }

    // ── Modal de sincronización ─────────────────────────────────────────────
    if (state.dom.btnSyncPurchases) {
        state.dom.btnSyncPurchases.addEventListener('click', async () => {
            try {
                await api.loadPurchaseSuggestions();
            } catch { /* no bloquear apertura del modal */ }
            render.modals.sync.open();
        });
    }

    if (state.dom.btnCloseSyncModal)  state.dom.btnCloseSyncModal.addEventListener('click', () => render.modals.sync.close());
    if (state.dom.btnCancelSync)      state.dom.btnCancelSync.addEventListener('click',     () => render.modals.sync.close());

    if (state.dom.btnExecuteSync) {
        state.dom.btnExecuteSync.addEventListener('click', async () => {
            const file = state.dom.syncFileInput.files?.[0];
            if (!file) {
                showErrorModal('Selecciona un archivo JSON de compra antes de continuar.', 'Archivo requerido');
                return;
            }

            const orderId = state.dom.syncOrderSelector.value || null;
            const btn = state.dom.btnExecuteSync;
            const originalHTML = btn.innerHTML;

            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">autorenew</span> Sincronizando...';

                const textData = await file.text();
                let payload;
                try {
                    payload = JSON.parse(textData);
                } catch {
                    throw new Error('El archivo no tiene un formato JSON válido.');
                }

                await api.syncPurchases(payload, orderId);
                render.modals.sync.close();
            } catch (error) {
                showErrorModal(error.message || 'Error conectando con la base de datos de compras.', 'Fallo de Sincronización');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                state.dom.syncFileInput.value = '';
            }
        });
    }

    // ── Filtros de Kardex ───────────────────────────────────────────────────
    if (state.dom.kardexLocationFilter) {
        state.dom.kardexLocationFilter.addEventListener('change', (e) => {
            state.ui.kardexLocation = e.target.value;
            api.loadKardex();
        });
    }

    if (state.dom.kardexItemFilter) {
        let timer;
        state.dom.kardexItemFilter.addEventListener('keyup', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.ui.kardexSearchQuery = e.target.value.trim().toUpperCase();
                api.loadKardex();
            }, 400);
        });
    }

    // ── Modales de traspaso y ajuste ────────────────────────────────────────
    if (state.dom.btnTransferClosers) {
        state.dom.btnTransferClosers.forEach(btn => {
            btn.addEventListener('click', () => render.modals.transfer.close());
        });
    }

    bindForm('form-transfer', async () => {
        const targetLoc = state.dom.transTargetLoc.value;
        const qty       = parseFloat(state.dom.formTransfer.querySelector('#trans-qty').value);
        const itemCode  = state.dom.transItemCode.value;

        if (!targetLoc) throw new Error('Debes seleccionar una ubicación destino.');

        await api.saveTransfer({
            sourceLocation: 'LOC-BODEGA',
            targetLocation: targetLoc,
            items: [{ itemCode, qty }]
        });
        render.modals.transfer.close();
    });

    if (state.dom.btnAdjustmentClosers) {
        state.dom.btnAdjustmentClosers.forEach(btn => {
            btn.addEventListener('click', () => render.modals.adjustment.close());
        });
    }

    if (state.dom.tbodyStockBodega) {
        state.dom.tbodyStockBodega.addEventListener('click', (e) => {
            const btnT = e.target.closest('.btn-traspasar');
            if (btnT) {
                render.modals.transfer.open(
                    btnT.getAttribute('data-code'),
                    btnT.getAttribute('data-name'),
                    btnT.getAttribute('data-unit')
                );
            }
            const btnA = e.target.closest('.btn-ajustar');
            if (btnA) {
                render.modals.adjustment.open(
                    btnA.getAttribute('data-code'),
                    btnA.getAttribute('data-name'),
                    btnA.getAttribute('data-unit'),
                    btnA.getAttribute('data-stock'),
                    btnA.getAttribute('data-location')
                );
            }
        });
    }

    if (state.dom.tbodyStockCocina) {
        state.dom.tbodyStockCocina.addEventListener('click', (e) => {
            const btnA = e.target.closest('.btn-ajustar');
            if (btnA) {
                render.modals.adjustment.open(
                    btnA.getAttribute('data-code'),
                    btnA.getAttribute('data-name'),
                    btnA.getAttribute('data-unit'),
                    btnA.getAttribute('data-stock'),
                    btnA.getAttribute('data-location')
                );
            }
        });
    }

    bindForm('form-adjustment', async (e) => {
        const realStock = parseFloat(state.dom.formAdjustment.querySelector('#adj-real-stock').value);
        const itemCode  = state.dom.adjItemCode.value;
        const note      = state.dom.formAdjustment.querySelector('#adj-note').value.trim();

        if (isNaN(realStock) || realStock < 0) throw new Error('Debes indicar un stock físico válido y positivo.');

        await api.saveAdjustment({
            locationCode: state.ui.stockLocation,
            items: [{ itemCode, realStock, note }]
        });
        render.modals.adjustment.close();
    });

    // ── Master-Detail Proveedores ────────────────────────────────────────────
    if (state.dom.listSuppliers) {
        state.dom.listSuppliers.addEventListener('click', (e) => {
            const card = e.target.closest('.supplier-card');
            if (card) {
                state.ui.selectedSupplierCode = card.getAttribute('data-code');
                render.suppliers();
            }
        });
    }

    const btnNewSup = document.querySelector('#btn-new-supplier');
    if (btnNewSup) {
        btnNewSup.addEventListener('click', () => {
            state.ui.selectedSupplierCode = 'NEW';
            state.dom.formSupplierProfile.reset();
            state.dom.formSupplierProfile.querySelector('#sup-code').value = '';
            render.supplierDetail();
        });
    }

    if (state.dom.inputLinkCode) {
        state.dom.inputLinkCode.addEventListener('blur', (e) => {
            const code = e.target.value.trim().toUpperCase();
            if (!code) return;
            e.target.value = code;

            const existingItem = state.data.stockBodega.find(item => item.code === code)
                              || state.data.stockCocina.find(item => item.code === code);

            if (existingItem) {
                state.dom.inputLinkName.value = existingItem.name;
                state.dom.inputLinkUnit.value = existingItem.unit;
                state.dom.inputLinkName.readOnly = true;
                state.dom.inputLinkUnit.disabled = true;
                state.dom.inputLinkName.classList.add('bg-slate-100', 'text-slate-500');
                state.dom.inputLinkUnit.classList.add('bg-slate-100', 'text-slate-500');
                state.dom.inputLinkPrice.focus();
            } else {
                state.dom.inputLinkName.value = '';
                state.dom.inputLinkName.readOnly = false;
                state.dom.inputLinkUnit.disabled = false;
                state.dom.inputLinkName.classList.remove('bg-slate-100', 'text-slate-500');
                state.dom.inputLinkUnit.classList.remove('bg-slate-100', 'text-slate-500');
                state.dom.inputLinkName.focus();
            }
        });
    }

    bindForm('form-inv-supplier', async (e) => {
        const form = e.target;
        const codeInput    = form.querySelector('#sup-code');
        const nameInput    = form.querySelector('#sup-name');
        const contactInput = form.querySelector('#sup-contact');

        if (!codeInput || !nameInput) throw new Error('Error DOM');

        const payload = {
            code: codeInput.value.trim().toUpperCase(),
            name: nameInput.value.trim(),
            contactName: contactInput ? contactInput.value.trim() : '',
            phone: ''
        };

        await api.saveSupplier(payload);
        state.ui.selectedSupplierCode = payload.code;

        setTimeout(() => {
            render.suppliers();
        }, 50);
    });

    bindForm('form-supplier-price', async (e) => {
        const form = e.target;
        const inputCode  = form.querySelector('#link-item-code');
        const inputName  = form.querySelector('#link-item-name');
        const inputPrice = form.querySelector('#link-item-price');

        if (!inputCode || !inputName || !inputPrice) throw new Error('Error DOM');

        const mappedPayload = {
            supplierCode: state.ui.selectedSupplierCode,
            itemCode:     inputCode.value.trim().toUpperCase(),
            itemName:     inputName.value.trim(),
            itemUnit:     state.dom.inputLinkUnit.value,
            price:        parseFloat(inputPrice.value)
        };

        await api.saveSupplierPrice(mappedPayload);
        await api.loadSuppliers();

        state.dom.inputLinkName.readOnly = false;
        state.dom.inputLinkUnit.disabled = false;
        state.dom.inputLinkName.classList.remove('bg-slate-100', 'text-slate-500');
        state.dom.inputLinkUnit.classList.remove('bg-slate-100', 'text-slate-500');

        setTimeout(() => {
            render.supplierDetail();
            inputCode.focus();
        }, 50);
    });
};
