// frontends/admin/js/views/inventario/view.js
import { state, uiConfig } from './state.js';

export const cacheDOM = (container) => {
    state.dom.root = container;

    // Helper resiliente: Busca primero en el Document global, si no, busca en el Container local
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

    // Tablas y Contenedores
    state.dom.tbodyKardex = container.querySelector('#table-kardex-body');
    state.dom.toggleSuggested = container.querySelector('#toggle-suggested');
    state.dom.listSuppliers = container.querySelector('#list-suppliers');
    state.dom.lockOverlay = container.querySelector('#supplier-lock-overlay');
    state.dom.productsLockOverlay = container.querySelector('#products-lock-overlay');
    state.dom.tablePricesBody = container.querySelector('#table-supplier-prices-body');

    // Formularios e Inputs
    state.dom.formSupplierProfile = container.querySelector('#form-inv-supplier');
    state.dom.formSupplierPrice = container.querySelector('#form-supplier-price');
    state.dom.inputLinkCode = container.querySelector('#link-item-code');
    state.dom.inputLinkName = container.querySelector('#link-item-name');
    state.dom.inputLinkUnit = container.querySelector('#link-item-unit');
    state.dom.inputLinkPrice = container.querySelector('#link-item-price');

    // Nuevos Filtros, Modales y Botón de Sync
    state.dom.kardexLocationFilter = container.querySelector('#kardex-location-filter');
    state.dom.kardexItemFilter = container.querySelector('#kardex-item-filter');

    state.dom.modalTransfer = container.querySelector('#modal-transfer');
    state.dom.formTransfer = container.querySelector('#form-transfer');
    state.dom.transItemCode = container.querySelector('#trans-item-code');
    state.dom.transItemName = container.querySelector('#trans-item-name');
    state.dom.transSourceLoc = container.querySelector('#trans-source-loc');
    state.dom.transTargetLoc = container.querySelector('#trans-target-loc');
    state.dom.transItemUnit = container.querySelector('#trans-item-unit');
    state.dom.btnTransferClosers = container.querySelectorAll('.btn-close-transfer');

    state.dom.modalAdjustment = container.querySelector('#modal-adjustment');
    state.dom.formAdjustment = container.querySelector('#form-adjustment');
    state.dom.adjItemCode = container.querySelector('#adj-item-code');
    state.dom.adjLocationCode = container.querySelector('#adj-location-code');
    state.dom.adjItemName = container.querySelector('#adj-item-name');
    state.dom.adjCurrentStock = container.querySelector('#adj-current-stock');
    state.dom.adjItemUnit = container.querySelector('#adj-item-unit');
    state.dom.adjItemUnitDisplay = container.querySelector('#adj-item-unit-display');
    state.dom.btnAdjustmentClosers = container.querySelectorAll('.btn-close-adjustment');

    state.dom.btnSyncPurchases = container.querySelector('#btn-sync-purchases');
    state.dom.tplStockRow = getTpl('#tpl-row-stock');

    // 🟢 TEMPLATES OBLIGATORIOS (Búsqueda Resiliente)
    state.dom.tplStock = getTpl('#tpl-row-stock');
    state.dom.tplKardex = getTpl('#tpl-row-kardex');
    state.dom.tplSupplierCard = getTpl('#tpl-supplier-card');
    state.dom.tplSupplierPrice = getTpl('#tpl-row-supplier-price');
};

export const render = {
    switchTab: (activeTabKey) => {
        Object.keys(state.dom.tabs).forEach(key => {
            const isMatch = key === activeTabKey;
            state.dom.tabs[key].className = isMatch ? uiConfig.tabs.active : uiConfig.tabs.inactive;
            state.dom.views[key].classList.toggle('hidden', !isMatch);

            if (isMatch && key === 'suppliers') {
                state.dom.views[key].style.display = 'flex';
            } else if (isMatch) {
                state.dom.views[key].style.display = 'flex';
            } else {
                state.dom.views[key].style.display = 'none';
            }
        });
    },

    suppliers: () => {
        state.dom.listSuppliers.innerHTML = '';

        state.data.suppliers.forEach(sup => {
            const clone = state.dom.tplSupplierCard.content.cloneNode(true);
            const card = clone.querySelector('.supplier-card');

            clone.querySelector('.col-name').textContent = sup.name;
            clone.querySelector('.col-code').textContent = sup.code;

            // 🟢 NUEVO: Leer el arreglo de precios y actualizar el contador visual
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
        // Candado Maestro
        if (!state.ui.selectedSupplierCode) {
            state.dom.lockOverlay.classList.remove('hidden');
            state.dom.lockOverlay.classList.add('flex');
            state.dom.tablePricesBody.innerHTML = ''; // Limpiar tabla
            return;
        }

        state.dom.lockOverlay.classList.add('hidden');
        state.dom.lockOverlay.classList.remove('flex');

        // Candado Secundario (Nuevo sin guardar)
        if (state.ui.selectedSupplierCode === 'NEW') {
            state.dom.productsLockOverlay.classList.remove('hidden');
            state.dom.productsLockOverlay.classList.add('flex');
            state.dom.formSupplierProfile.reset();
            state.dom.tablePricesBody.innerHTML = ''; // Limpiar tabla
            return;
        }

        state.dom.productsLockOverlay.classList.add('hidden');
        state.dom.productsLockOverlay.classList.remove('flex');

        const sup = state.data.suppliers.find(s => s.code === state.ui.selectedSupplierCode);
        if (!sup) return;

        // Hidratación del perfil
        state.dom.formSupplierProfile.querySelector('#sup-code').value = sup.code;
        state.dom.formSupplierProfile.querySelector('#sup-name').value = sup.name;
        const contactInput = state.dom.formSupplierProfile.querySelector('#sup-contact');
        if (contactInput) contactInput.value = sup.contactName || sup.contact_name || '';

        // 🟢 NUEVO: Pintar la tabla con los insumos vinculados
        state.dom.tablePricesBody.innerHTML = '';
        const prices = sup.prices || [];

        if (prices.length === 0) {
            // Mensaje vacío elegante si no hay insumos
            state.dom.tablePricesBody.textContent = '';
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.className = 'py-4 text-center text-slate-400 text-xs font-medium';
            td.textContent = 'No hay productos vinculados aún';
            tr.appendChild(td);
            state.dom.tablePricesBody.appendChild(tr);
        } else {
            // Llenar filas
            prices.forEach(p => {
                const clone = state.dom.tplSupplierPrice.content.cloneNode(true);
                clone.querySelector('.col-code').textContent = p.itemCode || p.item_code;
                clone.querySelector('.col-name').textContent = p.itemName || p.item_name;
                clone.querySelector('.col-price').textContent = `$${parseFloat(p.price || 0).toFixed(2)}`;
                state.dom.tablePricesBody.appendChild(clone);
            });
        }
    },
    // Reemplaza render.stock() por:

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
                // Solo Bodega tiene traspaso; en Cocina el botón Traspasar no aplica
                btnAjustar.setAttribute('data-location', isBodega ? 'LOC-BODEGA' : 'LOC-COCINA');
            }

            const btnTraspasar = clone.querySelector('.btn-traspasar');
            if (btnTraspasar) {
                if (!isBodega) {
                    // Ocultar el botón de traspaso en la tabla de Cocina
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

    kardex: () => {
        state.dom.tbodyKardex.innerHTML = '';
        state.data.kardex.forEach(mov => {
            const clone = state.dom.tplKardex.content.cloneNode(true);
            const mType = mov.type || mov.transaction_type;
            const conf = uiConfig.transactionType[mType] || uiConfig.transactionType.DEFAULT;

            clone.querySelector('.col-date').textContent = new Date(mov.date || mov.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

            const badge = clone.querySelector('.col-type-badge');
            badge.className = `px-2 py-1 text-[10px] font-bold rounded col-type-badge tracking-wider ${conf.badge}`;
            badge.textContent = conf.label;

            clone.querySelector('.col-origin').textContent = mov.origin || mov.from_location_code || '-';
            clone.querySelector('.col-dest').textContent = mov.dest || mov.to_location_code || '-';
            clone.querySelector('.col-ingredient').textContent = mov.ingredient || mov.item_name || mov.item_code || 'Desconocido';

            const qtyEl = clone.querySelector('.col-qty');
            const qtyNum = parseFloat(mov.quantity || 0);

            // Lógica Pura Visual de Signo para Kardex
            let sign = '';
            if (mType === 'IN') sign = '+';
            else if (mType === 'OUT' || mType === 'ADJ' && qtyNum < 0) sign = '-';
            // Para traspasos el numero es absoluto

            qtyEl.textContent = `${sign}${Math.abs(qtyNum)}`;
            if (mType === 'IN' || (mType === 'ADJ' && qtyNum > 0)) qtyEl.classList.add('text-emerald-600');
            else if (mType === 'OUT' || mType === 'ADJ') qtyEl.classList.add('text-orange-600');
            else if (mType === 'TRANSFER') qtyEl.classList.add('text-purple-600');
            else qtyEl.classList.add('text-slate-600');

            clone.querySelector('.col-ref').textContent = mov.reference || mov.reference_id || '-';
            state.dom.tbodyKardex.appendChild(clone);
        });
    },

    // Modal Manager
    modals: {
        transfer: {
            open: (code, name, unit) => {
                state.dom.transItemCode.value = code;
                state.dom.transItemName.textContent = name;
                state.dom.transSourceLoc.textContent = state.ui.stockLocation;
                state.dom.transItemUnit.textContent = unit;
                state.dom.formTransfer.reset();

                // Deshabilitar la opción Origen en Destino
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
            open: (code, name, unit, currentStock) => {
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
        }
    }
};