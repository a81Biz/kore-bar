// frontends/admin/js/views/inventario/view.js
import { state, uiConfig } from './state.js';

const _formatCurrency = (val) => {
    const n = parseFloat(val) || 0;
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const STATUS_MAP = {
    DRAFT:     { text: 'BORRADOR',  cls: 'bg-yellow-100 text-yellow-800' },
    SENT:      { text: 'ENVIADO',   cls: 'bg-blue-100 text-blue-800' },
    PARTIAL:   { text: 'PARCIAL',   cls: 'bg-orange-100 text-orange-800' },
    RECEIVED:  { text: 'RECIBIDO',  cls: 'bg-emerald-100 text-emerald-800' },
    CANCELLED: { text: 'CANCELADO', cls: 'bg-red-100 text-red-800' }
};

const ORIGIN_LABEL = { KITCHEN: '🍳 Cocina', ADMIN: '🏢 Admin', MANUAL: '✏️ Manual' };
const ORIGIN_BADGE = {
    KITCHEN: 'bg-orange-100 text-orange-800',
    ADMIN:   'bg-indigo-100 text-indigo-800',
    MANUAL:  'bg-slate-100 text-slate-800'
};

export const cacheDOM = (container) => {
    state.dom.root = container;

    const getTpl = (id) => {
        const tpl = document.querySelector(id) || container.querySelector(id);
        if (!tpl) console.warn(`[ViewManager] No se encontró el template: ${id}`);
        return tpl;
    };

    // Tabs & Vistas
    state.dom.tabs = {
        suppliers: container.querySelector('#tab-suppliers'),
        stock: container.querySelector('#tab-stock'),
        kardex: container.querySelector('#tab-kardex')
    };
    state.dom.views = {
        suppliers: container.querySelector('#view-suppliers'),
        stock: container.querySelector('#view-stock'),
        kardex: container.querySelector('#view-kardex')
    };

    state.dom.tbodyStockBodega = container.querySelector('#table-stock-bodega-body');
    state.dom.tbodyStockCocina = container.querySelector('#table-stock-cocina-body');
    state.dom.tbodyKardex      = container.querySelector('#table-kardex-body');
    state.dom.toggleSuggested  = container.querySelector('#toggle-suggested');
    state.dom.listSuppliers    = container.querySelector('#list-suppliers');
    state.dom.lockOverlay      = container.querySelector('#supplier-lock-overlay');
    state.dom.productsLockOverlay = container.querySelector('#products-lock-overlay');
    state.dom.tablePricesBody  = container.querySelector('#table-supplier-prices-body');

    state.dom.formSupplierProfile = container.querySelector('#form-inv-supplier');
    state.dom.formSupplierPrice   = container.querySelector('#form-supplier-price');
    state.dom.inputLinkCode  = container.querySelector('#link-item-code');
    state.dom.inputLinkName  = container.querySelector('#link-item-name');
    state.dom.inputLinkUnit  = container.querySelector('#link-item-unit');
    state.dom.inputLinkPrice = container.querySelector('#link-item-price');

    state.dom.kardexLocationFilter = container.querySelector('#kardex-location-filter');
    state.dom.kardexItemFilter     = container.querySelector('#kardex-item-filter');

    // Modales de traspaso y ajuste
    state.dom.modalTransfer   = container.querySelector('#modal-transfer');
    state.dom.formTransfer    = container.querySelector('#form-transfer');
    state.dom.transItemCode   = container.querySelector('#trans-item-code');
    state.dom.transItemName   = container.querySelector('#trans-item-name');
    state.dom.transSourceLoc  = container.querySelector('#trans-source-loc');
    state.dom.transTargetLoc  = container.querySelector('#trans-target-loc');
    state.dom.transItemUnit   = container.querySelector('#trans-item-unit');
    state.dom.btnTransferClosers = container.querySelectorAll('.btn-close-transfer');

    state.dom.modalAdjustment    = container.querySelector('#modal-adjustment');
    state.dom.formAdjustment     = container.querySelector('#form-adjustment');
    state.dom.adjItemCode        = container.querySelector('#adj-item-code');
    state.dom.adjLocationCode    = container.querySelector('#adj-location-code');
    state.dom.adjItemName        = container.querySelector('#adj-item-name');
    state.dom.adjCurrentStock    = container.querySelector('#adj-current-stock');
    state.dom.adjItemUnit        = container.querySelector('#adj-item-unit');
    state.dom.adjItemUnitDisplay = container.querySelector('#adj-item-unit-display');
    state.dom.btnAdjustmentClosers = container.querySelectorAll('.btn-close-adjustment');

    // Modal de sincronización
    state.dom.modalSync        = container.querySelector('#modal-sync');
    state.dom.syncOrderSelector = container.querySelector('#sync-order-selector');
    state.dom.syncFileInput    = container.querySelector('#sync-file-input');
    state.dom.btnExecuteSync   = container.querySelector('#btn-execute-sync');
    state.dom.btnCloseSyncModal  = container.querySelector('#btn-close-sync-modal');
    state.dom.btnCancelSync    = container.querySelector('#btn-cancel-sync');

    // Botón de sync (ahora un <button> simple)
    state.dom.btnSyncPurchases = container.querySelector('#btn-sync-purchases');

    // Paneles del pedido de compra activo
    state.dom.stockSplitGrid        = container.querySelector('#stock-split-grid');
    state.dom.purchaseOrdersPanel   = container.querySelector('#panel-purchase-orders');
    state.dom.purchaseOrdersEmpty   = container.querySelector('#purchase-orders-empty');
    state.dom.purchaseOrderHeader   = container.querySelector('#purchase-order-header');
    state.dom.purchaseOrderTableWrap = container.querySelector('#purchase-order-table-wrap');
    state.dom.poStatusBadge         = container.querySelector('#po-status-badge');
    state.dom.poMeta                = container.querySelector('#po-meta');
    state.dom.poItemsBody           = container.querySelector('#po-items-body');
    state.dom.formAddPoItem         = container.querySelector('#form-add-po-item');
    state.dom.btnPrintOrder         = container.querySelector('#btn-print-order');
    state.dom.btnConfirmOrder       = container.querySelector('#btn-confirm-order');

    // Panel historial (tab kardex)
    state.dom.panelOrderHistory = container.querySelector('#panel-order-history');
    state.dom.listOrderHistory  = container.querySelector('#list-order-history');

    // Templates
    state.dom.tplStock          = getTpl('#tpl-row-stock');
    state.dom.tplKardex         = getTpl('#tpl-row-kardex');
    state.dom.tplSupplierCard   = getTpl('#tpl-supplier-card');
    state.dom.tplSupplierPrice  = getTpl('#tpl-row-supplier-price');
    state.dom.tplPoItemRow      = getTpl('#tpl-po-item-row');
    state.dom.tplOrderHistoryCard = getTpl('#tpl-order-history-card');
};

export const render = {
    switchTab: (activeTabKey) => {
        Object.keys(state.dom.tabs).forEach(key => {
            const isMatch = key === activeTabKey;
            state.dom.tabs[key].className = isMatch ? uiConfig.tabs.active : uiConfig.tabs.inactive;
            state.dom.views[key].style.display = isMatch ? 'flex' : 'none';
        });
    },

    suppliers: () => {
        state.dom.listSuppliers.innerHTML = '';

        state.data.suppliers.forEach(sup => {
            const clone = state.dom.tplSupplierCard.content.cloneNode(true);
            const card = clone.querySelector('.supplier-card');

            clone.querySelector('.col-name').textContent = sup.name;
            clone.querySelector('.col-code').textContent = sup.code;

            const productsCount = sup.prices ? sup.prices.length : 0;
            const colProducts = clone.querySelector('.col-products');
            if (colProducts) colProducts.textContent = `${productsCount} productos vinculados`;

            if (state.ui.selectedSupplierCode === sup.code) {
                card.classList.add('border-indigo-500', 'bg-indigo-50', 'ring-1', 'ring-indigo-500');
            }

            card.setAttribute('data-code', sup.code);
            state.dom.listSuppliers.appendChild(clone);
        });

        render.supplierDetail();
    },

    supplierDetail: () => {
        if (!state.ui.selectedSupplierCode) {
            state.dom.lockOverlay.classList.remove('hidden');
            state.dom.lockOverlay.classList.add('flex');
            state.dom.tablePricesBody.innerHTML = '';
            return;
        }

        state.dom.lockOverlay.classList.add('hidden');
        state.dom.lockOverlay.classList.remove('flex');

        if (state.ui.selectedSupplierCode === 'NEW') {
            state.dom.productsLockOverlay.classList.remove('hidden');
            state.dom.productsLockOverlay.classList.add('flex');
            state.dom.formSupplierProfile.reset();
            state.dom.tablePricesBody.innerHTML = '';
            return;
        }

        state.dom.productsLockOverlay.classList.add('hidden');
        state.dom.productsLockOverlay.classList.remove('flex');

        const sup = state.data.suppliers.find(s => s.code === state.ui.selectedSupplierCode);
        if (!sup) return;

        state.dom.formSupplierProfile.querySelector('#sup-code').value = sup.code;
        state.dom.formSupplierProfile.querySelector('#sup-name').value = sup.name;
        const contactInput = state.dom.formSupplierProfile.querySelector('#sup-contact');
        if (contactInput) contactInput.value = sup.contactName || sup.contact_name || '';

        state.dom.tablePricesBody.innerHTML = '';
        const prices = sup.prices || [];

        if (prices.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.className = 'py-4 text-center text-slate-400 text-xs font-medium';
            td.textContent = 'No hay productos vinculados aún';
            tr.appendChild(td);
            state.dom.tablePricesBody.appendChild(tr);
        } else {
            prices.forEach(p => {
                const clone = state.dom.tplSupplierPrice.content.cloneNode(true);
                clone.querySelector('.col-code').textContent = p.itemCode || p.item_code;
                clone.querySelector('.col-name').textContent = p.itemName || p.item_name;
                clone.querySelector('.col-price').textContent = `$${parseFloat(p.price || 0).toFixed(2)}`;
                state.dom.tablePricesBody.appendChild(clone);
            });
        }
    },

    _renderStockTable: (tbody, items, isBodega) => {
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.className = 'px-4 py-6 text-center text-slate-400 text-sm';
            td.textContent = isBodega
                ? 'Sincroniza una compra para ver el stock de Bodega.'
                : 'Transfiere insumos desde Bodega para ver stock en Cocina.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        items.forEach(item => {
            const clone = state.dom.tplStock.content.cloneNode(true);
            clone.querySelector('.col-code').textContent = item.code || item.item_code;
            clone.querySelector('.col-name').textContent = item.name || item.item_name;
            clone.querySelector('.col-qty').textContent =
                `${item.totalStock === null ? '0' : item.totalStock} ${item.recipeUnit || 'U'}`;

            const isCritical = parseFloat(item.totalStock || 0) <= parseFloat(item.minStock || 0);
            const statusConf = isCritical ? uiConfig.stockStatus.CRITICAL : uiConfig.stockStatus.OK;

            const badge = clone.querySelector('.col-status-badge');
            badge.className = `col-status-badge px-2 py-1 text-[10px] font-bold rounded ${statusConf.badge}`;
            badge.textContent = statusConf.label;

            const btnAjustar = clone.querySelector('.btn-ajustar');
            if (btnAjustar) {
                btnAjustar.setAttribute('data-code', item.code || item.item_code);
                btnAjustar.setAttribute('data-name', item.name || item.item_name);
                btnAjustar.setAttribute('data-unit', item.unit || item.unit_measure || 'U');
                btnAjustar.setAttribute('data-stock', item.stock);
                btnAjustar.setAttribute('data-location', isBodega ? 'LOC-BODEGA' : 'LOC-COCINA');
            }

            const btnTraspasar = clone.querySelector('.btn-traspasar');
            if (btnTraspasar) {
                if (!isBodega) {
                    btnTraspasar.style.display = 'none';
                } else {
                    btnTraspasar.setAttribute('data-code', item.code || item.item_code);
                    btnTraspasar.setAttribute('data-name', item.name || item.item_name);
                    btnTraspasar.setAttribute('data-unit', item.unit || item.unit_measure || 'U');
                }
            }

            tbody.appendChild(clone);
        });
    },

    stockBodega: () => {
        const items = state.ui.showOnlySuggested
            ? state.data.stockBodega.filter(i => parseFloat(i.stock || 0) <= parseFloat(i.minStock || 0))
            : state.data.stockBodega;
        render._renderStockTable(state.dom.tbodyStockBodega, items, true);
    },

    stockCocina: () => {
        render._renderStockTable(state.dom.tbodyStockCocina, state.data.stockCocina, false);
    },

    // Admin shows the most recent SENT or PARTIAL order (kitchen already approved it).
    purchaseSuggestions: () => {
        const activeOrder = state.data.purchaseSuggestions.find(o => ['SENT', 'PARTIAL'].includes(o.status));

        if (!activeOrder) {
            state.ui.activeOrderId = null;
            state.dom.purchaseOrdersEmpty.classList.remove('hidden');
            state.dom.purchaseOrderHeader.classList.add('hidden');
            state.dom.purchaseOrderTableWrap.classList.add('hidden');
            state.dom.formAddPoItem.classList.add('hidden');
            return;
        }

        state.ui.activeOrderId = activeOrder.orderId;
        state.dom.purchaseOrdersEmpty.classList.add('hidden');
        state.dom.purchaseOrderHeader.classList.remove('hidden');
        state.dom.purchaseOrderTableWrap.classList.remove('hidden');
        state.dom.formAddPoItem.classList.remove('hidden');

        // Hide "Confirmar" — kitchen sends the order, admin only receives
        state.dom.btnConfirmOrder.classList.add('hidden');

        // Status badge
        const statusConf = STATUS_MAP[activeOrder.status] || { text: activeOrder.status, cls: 'bg-slate-100 text-slate-800' };
        state.dom.poStatusBadge.textContent = statusConf.text;
        state.dom.poStatusBadge.className = `px-2 py-0.5 text-[10px] font-bold rounded tracking-wider ${statusConf.cls}`;

        // Meta line
        const generatedAt = activeOrder.generatedAt
            ? new Date(activeOrder.generatedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
            : 'Sin fecha';
        state.dom.poMeta.textContent =
            `Enviado: ${generatedAt} · Total: ${_formatCurrency(activeOrder.totalAmount)} · ${(activeOrder.items || []).length} insumo(s)`;

        // Items table
        state.dom.poItemsBody.innerHTML = '';
        (activeOrder.items || []).forEach(item => {
            const clone = state.dom.tplPoItemRow.content.cloneNode(true);

            const origin = item.origin || 'MANUAL';
            const diff = parseFloat(item.difference ?? (item.qtySuggested - (item.qtyDelivered || 0)));

            clone.querySelector('.col-origin').innerHTML =
                `<span class="px-2 py-0.5 text-[10px] font-bold rounded ${ORIGIN_BADGE[origin] || 'bg-slate-100 text-slate-800'}">${ORIGIN_LABEL[origin] || origin}</span>`;
            clone.querySelector('.col-item-name').textContent = item.itemName;
            clone.querySelector('.col-supplier').textContent  = item.supplierName || '—';
            clone.querySelector('.col-qty-suggested').textContent = item.qtySuggested;
            clone.querySelector('.col-qty-delivered').textContent = item.qtyDelivered ?? 0;

            const diffEl = clone.querySelector('.col-difference');
            diffEl.textContent = diff.toFixed(3);
            if (diff > 0) diffEl.classList.add('text-red-600', 'font-bold');

            clone.querySelector('.col-unit-price').textContent = _formatCurrency(item.unitPrice);

            // Admin can remove items from SENT/PARTIAL orders (e.g. correction)
            const btnRemove = clone.querySelector('.btn-remove-po-item');
            btnRemove.setAttribute('data-line-id', item.lineId);
            btnRemove.setAttribute('data-order-id', activeOrder.orderId);

            state.dom.poItemsBody.appendChild(clone);
        });
    },

    // Shows completed orders (RECEIVED / CANCELLED) in the Historial tab.
    orderHistory: () => {
        const completed = state.data.purchaseSuggestions.filter(o => ['RECEIVED', 'CANCELLED'].includes(o.status));

        if (completed.length === 0) {
            state.dom.panelOrderHistory.classList.add('hidden');
            return;
        }

        state.dom.panelOrderHistory.classList.remove('hidden');
        state.dom.listOrderHistory.innerHTML = '';

        completed.forEach(order => {
            const clone = state.dom.tplOrderHistoryCard.content.cloneNode(true);

            const date = new Date(order.generatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
            clone.querySelector('.col-date').textContent = date;

            const statusConf = STATUS_MAP[order.status] || { text: order.status, cls: 'bg-slate-100 text-slate-800' };
            const badge = clone.querySelector('.col-status-badge');
            badge.textContent = statusConf.text;
            badge.className = `col-status-badge px-2 py-0.5 text-[10px] font-bold rounded tracking-wider ${statusConf.cls}`;

            clone.querySelector('.col-notes').textContent       = order.notes || '';
            clone.querySelector('.col-items-count').textContent = (order.items || []).length;
            clone.querySelector('.col-total').textContent       = _formatCurrency(order.totalAmount);

            state.dom.listOrderHistory.appendChild(clone);
        });
    },

    kardex: () => {
        state.dom.tbodyKardex.innerHTML = '';

        state.data.kardex.forEach(mov => {
            const clone = state.dom.tplKardex.content.cloneNode(true);

            const mType = mov.transactionType || mov.type || mov.transaction_type;
            const conf = uiConfig.transactionType[mType] || uiConfig.transactionType.DEFAULT;

            clone.querySelector('.col-date').textContent = new Date(
                mov.date || mov.created_at
            ).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

            const badge = clone.querySelector('.col-type-badge');
            badge.className = `px-2 py-1 text-[10px] font-bold rounded col-type-badge tracking-wider ${conf.badge}`;
            badge.textContent = conf.label;

            clone.querySelector('.col-origin').textContent = mov.fromLocation || mov.origin || mov.from_location_code || '-';
            clone.querySelector('.col-dest').textContent   = mov.toLocation   || mov.dest   || mov.to_location_code   || '-';
            clone.querySelector('.col-ingredient').textContent =
                mov.itemName || mov.ingredient || mov.item_name || mov.item_code || 'Desconocido';

            const qtyEl = clone.querySelector('.col-qty');
            const qtyNum = parseFloat(mov.quantity || 0);

            let sign = '';
            if (mType === 'IN' || mType === 'IN_PURCHASE') sign = '+';
            else if (mType === 'OUT' || (mType === 'ADJ' && qtyNum < 0)) sign = '-';

            qtyEl.textContent = `${sign}${Math.abs(qtyNum)}`;

            if (mType === 'IN' || mType === 'IN_PURCHASE')          qtyEl.classList.add('text-emerald-600');
            else if (mType === 'OUT' || mType === 'ADJ')            qtyEl.classList.add('text-orange-600');
            else if (mType === 'TRANSFER')                          qtyEl.classList.add('text-purple-600');
            else                                                    qtyEl.classList.add('text-slate-600');

            clone.querySelector('.col-ref').textContent =
                mov.referenceId || mov.reference || mov.reference_id || '-';

            state.dom.tbodyKardex.appendChild(clone);
        });
    },

    modals: {
        transfer: {
            open: (code, name, unit) => {
                state.dom.transItemCode.value = code;
                state.dom.transItemName.textContent = name;
                state.dom.transSourceLoc.textContent = state.ui.stockLocation;
                state.dom.transItemUnit.textContent = unit;
                state.dom.formTransfer.reset();

                Array.from(state.dom.transTargetLoc.options).forEach(opt => {
                    opt.disabled = (opt.value === 'LOC-BODEGA');
                });

                state.dom.modalTransfer.classList.remove('opacity-0', 'pointer-events-none');
                state.dom.modalTransfer.firstElementChild.classList.remove('scale-95');
            },
            close: () => {
                state.dom.modalTransfer.classList.add('opacity-0', 'pointer-events-none');
                state.dom.modalTransfer.firstElementChild.classList.add('scale-95');
            }
        },
        adjustment: {
            open: (code, name, unit, currentStock, locationCode) => {
                state.ui.stockLocation = locationCode || 'LOC-BODEGA';
                state.dom.adjItemCode.value = code;
                state.dom.adjLocationCode.value = state.ui.stockLocation;
                state.dom.adjItemName.textContent = name;
                state.dom.adjCurrentStock.textContent = currentStock;
                state.dom.adjItemUnit.textContent = unit;
                state.dom.adjItemUnitDisplay.textContent = unit;
                state.dom.formAdjustment.reset();

                state.dom.modalAdjustment.classList.remove('opacity-0', 'pointer-events-none');
                state.dom.modalAdjustment.firstElementChild.classList.remove('scale-95');
            },
            close: () => {
                state.dom.modalAdjustment.classList.add('opacity-0', 'pointer-events-none');
                state.dom.modalAdjustment.firstElementChild.classList.add('scale-95');
            }
        },
        sync: {
            open: () => {
                // Populate dropdown with SENT/PARTIAL orders
                state.dom.syncOrderSelector.innerHTML = '<option value="">Sin asociar — solo actualizar stock</option>';
                const syncable = state.data.purchaseSuggestions.filter(o => ['SENT', 'PARTIAL'].includes(o.status));
                syncable.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.orderId;
                    const date = new Date(o.generatedAt).toLocaleDateString('es-MX', { dateStyle: 'short' });
                    const statusConf = STATUS_MAP[o.status] || { text: o.status };
                    opt.textContent = `${date} — ${(o.items || []).length} insumos · ${statusConf.text}`;
                    state.dom.syncOrderSelector.appendChild(opt);
                });

                state.dom.syncFileInput.value = '';
                state.dom.modalSync.classList.remove('opacity-0', 'pointer-events-none');
                state.dom.modalSync.firstElementChild.classList.remove('scale-95');
            },
            close: () => {
                state.dom.modalSync.classList.add('opacity-0', 'pointer-events-none');
                state.dom.modalSync.firstElementChild.classList.add('scale-95');
            }
        }
    }
};
