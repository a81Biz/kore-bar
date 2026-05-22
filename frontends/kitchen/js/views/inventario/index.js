// frontends/kitchen/js/views/inventario/index.js
import { fetchData, postData, patchData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { PubSub } from '/shared/js/pubsub.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';

// ── ESTADO ────────────────────────────────────────────────────────────────
const state = {
    dom: {
        root: null,
        tableBody: null,
        tplRow: null,
        btnSubmit: null,
        navButtons: null,
        tabBtns: null,
        panelToma: null,
        panelPedido: null,
        btnGenerate: null,
        ordersContainer: null,
        ordersEmpty: null,
        tplOrderCard: null
    },
    stock: [],
    purchaseOrders: []
};

// ── UTILIDADES ────────────────────────────────────────────────────────────
const _fmt = (val) => {
    const n = parseFloat(val) || 0;
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const STATUS_MAP = {
    DRAFT:    { text: 'BORRADOR',  headerCls: 'bg-indigo-50 border-indigo-100',   iconCls: 'text-indigo-600', titleCls: 'text-indigo-800', metaCls: 'text-indigo-600', badgeCls: 'bg-yellow-100 text-yellow-800' },
    SENT:     { text: 'ENVIADO',   headerCls: 'bg-slate-50 border-slate-200',     iconCls: 'text-slate-500',  titleCls: 'text-slate-700',  metaCls: 'text-slate-500',  badgeCls: 'bg-blue-100 text-blue-800' },
    PARTIAL:  { text: 'PARCIAL',   headerCls: 'bg-orange-50 border-orange-200',   iconCls: 'text-orange-600', titleCls: 'text-orange-800', metaCls: 'text-orange-600', badgeCls: 'bg-orange-100 text-orange-800' },
    RECEIVED: { text: 'RECIBIDO',  headerCls: 'bg-emerald-50 border-emerald-200', iconCls: 'text-emerald-600',titleCls: 'text-emerald-800',metaCls: 'text-emerald-600',badgeCls: 'bg-emerald-100 text-emerald-800' }
};
const ORIGIN_LABEL = { KITCHEN: '🍳 Cocina', ADMIN: '🏢 Admin', MANUAL: '✏️ Manual' };

// ── RENDERIZADO ───────────────────────────────────────────────────────────
const render = {
    cacheDOM: (container) => {
        state.dom.root         = container;
        state.dom.navButtons   = container.querySelectorAll('[data-nav]');
        state.dom.tableBody    = container.querySelector('#table-kitchen-stock');
        state.dom.tplRow       = document.querySelector('#tpl-row-kitchen-stock');
        state.dom.btnSubmit    = container.querySelector('#btn-submit-blind');
        state.dom.tabBtns      = container.querySelectorAll('.kitchen-inv-tab');
        state.dom.panelToma    = container.querySelector('#ktab-toma');
        state.dom.panelPedido  = container.querySelector('#ktab-pedido');
        state.dom.btnGenerate  = container.querySelector('#btn-generate-order');
        state.dom.ordersContainer = container.querySelector('#kitchen-orders-container');
        state.dom.ordersEmpty     = container.querySelector('#kitchen-orders-empty');
        state.dom.tplOrderCard    = document.querySelector('#tpl-kitchen-order-card');
    },

    switchTab: (tabKey) => {
        state.dom.tabBtns.forEach(btn => {
            const isActive = btn.getAttribute('data-ktab') === tabKey;
            btn.className = isActive
                ? 'kitchen-inv-tab px-4 py-1.5 text-sm font-bold rounded-md bg-white text-indigo-600 shadow-sm transition-all'
                : 'kitchen-inv-tab px-4 py-1.5 text-sm font-bold rounded-md text-slate-600 hover:text-slate-800 transition-all';
        });
        state.dom.panelToma.classList.toggle('hidden', tabKey !== 'toma');
        state.dom.panelPedido.classList.toggle('hidden', tabKey !== 'pedido');
    },

    stockList: () => {
        state.dom.tableBody.innerHTML = '';
        state.stock.forEach((item, index) => {
            const clon = state.dom.tplRow.content.cloneNode(true);
            clon.querySelector('.col-name').textContent = item.name;
            clon.querySelector('.col-code').textContent = item.code;

            const stock    = parseFloat(item.stock) || 0;
            const consumed = parseFloat(item.dailyConsumption) || 0;
            const expected = stock - consumed;

            clon.querySelector('.col-teorico').textContent  = `${stock} ${item.unitMeasure}`;
            clon.querySelector('.col-consumo').textContent  = `${consumed} ${item.unitMeasure}`;
            clon.querySelector('.col-esperado').textContent = `${expected.toFixed(3)} ${item.unitMeasure}`;
            clon.querySelector('.col-unit').textContent     = item.unitMeasure;

            const inputReal = clon.querySelector('.input-real-stock');
            inputReal.setAttribute('data-index', index);
            inputReal.value = expected.toFixed(3);

            state.dom.tableBody.appendChild(clon);
        });
    },

    orderCards: () => {
        // DRAFT orders first, then by date desc
        const orders = [...state.purchaseOrders].sort((a, b) => {
            if (a.status === 'DRAFT' && b.status !== 'DRAFT') return -1;
            if (b.status === 'DRAFT' && a.status !== 'DRAFT') return 1;
            return new Date(b.generatedAt) - new Date(a.generatedAt);
        });

        Array.from(state.dom.ordersContainer.children).forEach(child => {
            if (child.id !== 'kitchen-orders-empty') child.remove();
        });

        if (orders.length === 0) {
            state.dom.ordersEmpty.classList.remove('hidden');
            return;
        }
        state.dom.ordersEmpty.classList.add('hidden');

        orders.forEach(order => {
            const clone = state.dom.tplOrderCard.content.cloneNode(true);
            const card  = clone.querySelector('.kitchen-order-card');
            card.setAttribute('data-order-id', order.orderId);

            const isDraft = order.status === 'DRAFT';
            const conf = STATUS_MAP[order.status] || STATUS_MAP.SENT;

            // Header styling
            const header = clone.querySelector('.col-header');
            header.className = `col-header px-5 py-4 border-b flex flex-wrap justify-between items-center gap-4 ${conf.headerCls}`;
            clone.querySelector('.col-icon').className  = `col-icon material-symbols-outlined text-xl ${conf.iconCls}`;
            const titleEl = clone.querySelector('.col-title');
            titleEl.className   = `col-title font-black text-base ${conf.titleCls}`;
            titleEl.textContent = `PO-${order.orderId.slice(0, 8).toUpperCase()}`;
            clone.querySelector('.col-meta').className  = `col-meta text-xs ${conf.metaCls}`;

            // Status badge
            const badge = clone.querySelector('.col-status-badge');
            badge.textContent = conf.text;
            badge.className   = `col-status-badge px-2 py-0.5 text-[10px] font-bold rounded tracking-wider ${conf.badgeCls}`;

            const date = order.generatedAt
                ? new Date(order.generatedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                : 'N/D';
            clone.querySelector('.col-date').textContent  = date;
            clone.querySelector('.col-total').textContent = _fmt(order.totalAmount);

            // DRAFT-only controls
            if (isDraft) {
                clone.querySelector('.btn-send-kitchen-order').classList.remove('hidden');
                clone.querySelector('.col-remove-header').classList.remove('hidden');
                clone.querySelector('.form-add-kitchen-item').classList.remove('hidden');
            }

            // Items rows
            const tbody = clone.querySelector('.col-items');
            (order.items || []).forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50';
                tr.innerHTML = `
                    <td class="px-4 py-2.5 text-xs">${ORIGIN_LABEL[item.origin] || item.origin}</td>
                    <td class="px-4 py-2.5 font-medium text-slate-800">${item.itemName}</td>
                    <td class="px-4 py-2.5 text-xs text-slate-500">${item.supplierName || '—'}</td>
                    <td class="px-4 py-2.5 text-right font-bold text-indigo-700">${item.qtySuggested}</td>
                    <td class="px-4 py-2.5 text-right font-mono text-slate-600">${_fmt(item.unitPrice)}</td>
                    <td class="px-4 py-2.5 text-center">
                        ${isDraft
                            ? `<button class="btn-remove-kitchen-item text-slate-300 hover:text-red-500 transition-colors"
                                  data-line-id="${item.lineId}" data-order-id="${order.orderId}">
                                 <span class="material-symbols-outlined text-[18px]">remove_circle</span>
                               </button>`
                            : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Footer info
            const footer = clone.querySelector('.col-footer');
            if (isDraft) {
                footer.textContent = `${(order.items || []).length} insumo(s) · Revisa y ajusta el pedido. Cuando esté listo, envíalo al panel de Administración.`;
            } else {
                footer.textContent = `${(order.items || []).length} insumo(s) · Pedido enviado al proveedor`;
            }

            state.dom.ordersContainer.appendChild(clone);
        });
    }
};

// ── LÓGICA ────────────────────────────────────────────────────────────────
const logic = {
    loadStock: async () => {
        try {
            const res = await fetchData(ENDPOINTS.kitchen.get.kitchenStock);
            state.stock = res.data.stock || [];
            render.stockList();
        } catch (error) {
            showErrorModal('No se pudo cargar el inventario teórico local.', 'Error de Lectura');
        }
    },

    loadPurchaseOrders: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.purchaseSuggestions);
            state.purchaseOrders = res.data?.orders || [];
        } catch (error) {
            console.warn('[Inventario] No se pudieron cargar pedidos:', error.message);
            state.purchaseOrders = [];
        }
        render.orderCards();
    },

    generateOrder: async () => {
        const btn = state.dom.btnGenerate;
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">autorenew</span> Generando...';

            await postData(ENDPOINTS.admin.post.generatePurchaseSuggestions, {});
            await logic.loadPurchaseOrders();
            showSuccessModal(
                'El sistema calculó los insumos críticos y asignó el proveedor óptimo. Revisa el pedido, ajusta lo que necesites y envíalo al Admin.',
                'Pedido Generado'
            );
        } catch (error) {
            showErrorModal(error.message, 'Error al Generar Pedido');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">auto_awesome</span> Generar Pedido';
        }
    },

    sendOrder: async (orderId) => {
        if (!await confirmAction('¿El pedido está listo? Se enviará al panel de Administración y ya no podrás editarlo.')) return;
        try {
            await patchData(ENDPOINTS.admin.patch.sendPurchaseOrder, {}, { id: orderId });
            await logic.loadPurchaseOrders();
            showSuccessModal('Pedido enviado al panel de Administración.', 'Pedido Enviado');
        } catch (error) {
            showErrorModal(error.message, 'Error al Enviar Pedido');
        }
    },

    removeItem: async (orderId, lineId) => {
        try {
            await deleteData(ENDPOINTS.admin.deleteItem.removePurchaseOrderItem, { id: orderId, lineId });
            await logic.loadPurchaseOrders();
        } catch (error) {
            showErrorModal(error.message, 'Error al Quitar Insumo');
        }
    },

    addItem: async (orderId, form) => {
        const itemCode     = form.querySelector('.input-item-code').value.trim().toUpperCase();
        const supplierCode = form.querySelector('.input-supplier-code').value.trim().toUpperCase() || null;
        const qty          = parseFloat(form.querySelector('.input-qty').value);
        const price        = parseFloat(form.querySelector('.input-price').value) || 0;

        if (!itemCode || isNaN(qty) || qty <= 0) {
            showErrorModal('Código de insumo y cantidad son obligatorios.', 'Datos Incompletos');
            return;
        }

        try {
            await postData(ENDPOINTS.admin.postItem.addPurchaseOrderItem,
                { itemCode, supplierCode, qtySuggested: qty, unitPrice: price, origin: 'KITCHEN' },
                { id: orderId }
            );
            form.reset();
            await logic.loadPurchaseOrders();
        } catch (error) {
            showErrorModal(error.message, 'Error al Agregar Insumo');
        }
    },

    submitBlindInventory: async () => {
        const inputs = state.dom.tableBody.querySelectorAll('.input-real-stock');
        const itemsToAdjust = [];

        inputs.forEach(input => {
            const realStock = parseFloat(input.value);
            if (!isNaN(realStock)) {
                const item = state.stock[input.getAttribute('data-index')];
                if (item.currentStock !== realStock) {
                    itemsToAdjust.push({
                        itemCode: item.itemCode,
                        realStock: realStock,
                        note: 'Toma Física: Cuadre de Cierre de Turno en Cocina'
                    });
                }
            }
        });

        if (itemsToAdjust.length === 0) {
            return showSuccessModal('Ningún conteo difiere del sistema.', 'Inventario Estrictamente Cuadrado');
        }

        if (!await confirmAction(
            `El sistema detectó ${itemsToAdjust.length} insumos con descuadre. ¿Registrar la discrepancia en el Kardex?`
        )) return;

        try {
            state.dom.btnSubmit.disabled = true;
            state.dom.btnSubmit.textContent = 'Enviando Lote...';

            await postData(ENDPOINTS.inventory.post.adjustments, {
                locationCode: 'LOC-COCINA',
                items: itemsToAdjust
            });

            showSuccessModal('Tu conteo ciego se reconcilió. El Kardex ha sido consolidado.', 'Inventario Asentado');
            await logic.loadStock();
        } catch (error) {
            showErrorModal(error.message, 'Fallo de Asentación de Merma');
        } finally {
            state.dom.btnSubmit.disabled = false;
            state.dom.btnSubmit.textContent = 'Registrar Mermas y Cerrar Turno';
        }
    }
};

// ── CICLO DE VIDA PÚBLICO ─────────────────────────────────────────────────
export const InventarioController = {
    mount: async (container) => {
        render.cacheDOM(container);

        state.dom.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                PubSub.publish('NAVIGATE', e.currentTarget.getAttribute('data-nav'));
            });
        });

        state.dom.tabBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tabKey = e.currentTarget.getAttribute('data-ktab');
                render.switchTab(tabKey);
                if (tabKey === 'pedido') await logic.loadPurchaseOrders();
            });
        });

        state.dom.btnSubmit.addEventListener('click', logic.submitBlindInventory);
        state.dom.btnGenerate.addEventListener('click', logic.generateOrder);

        // Delegación de eventos en el contenedor de órdenes
        state.dom.ordersContainer.addEventListener('click', async (e) => {
            // Enviar pedido al admin
            const btnSend = e.target.closest('.btn-send-kitchen-order');
            if (btnSend) {
                const card = btnSend.closest('.kitchen-order-card');
                const orderId = card?.getAttribute('data-order-id');
                if (orderId) await logic.sendOrder(orderId);
                return;
            }
            // Quitar insumo del pedido
            const btnRemove = e.target.closest('.btn-remove-kitchen-item');
            if (btnRemove) {
                const lineId  = btnRemove.getAttribute('data-line-id');
                const orderId = btnRemove.getAttribute('data-order-id');
                if (lineId && orderId) await logic.removeItem(orderId, lineId);
                return;
            }
        });

        // Agregar insumo al pedido (formulario dentro de cada tarjeta)
        state.dom.ordersContainer.addEventListener('submit', async (e) => {
            const form = e.target.closest('.form-add-kitchen-item');
            if (!form) return;
            e.preventDefault();
            const card = form.closest('.kitchen-order-card');
            const orderId = card?.getAttribute('data-order-id');
            if (orderId) await logic.addItem(orderId, form);
        });

        await logic.loadStock();
    }
};
