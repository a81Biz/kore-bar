// frontends/admin/js/views/inventario/logic.js
import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { ValidatorEngine } from '/shared/js/validationEngine.js';
import { SupplierRules } from '../../rules/inventario.rules.js';
import { showSuccessModal, showErrorModal } from '/shared/js/ui.js';

import { state } from './state.js';
import { render } from './view.js';

const _validator = new ValidatorEngine(SupplierRules);

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
        const query = qStr ? `?${qStr}` : '';

        const res = await fetchData(`${ENDPOINTS.inventory.get.kardex}${query}`);
        state.data.kardex = res.data?.kardex || [];
        render.kardex();
    },
    saveSupplier: async (payload) => {
        const check = _validator.execute(payload);
        if (!check.isValid) throw new Error(check.error);

        // Permitir Update si ya existe en la UI local, de lo contrario validamos
        if (state.ui.selectedSupplierCode === 'NEW' && state.data.suppliers.find(s => s.code === payload.code)) {
            throw new Error(`El código ${payload.code} ya existe en el catálogo.`);
        }

        await postData(ENDPOINTS.inventory.post.suppliers, payload);
        showSuccessModal('Proveedor registrado exitosamente.');
        await api.loadSuppliers(); // Refresca catálogo desde BD
    },
    saveSupplierPrice: async (payload) => {
        await postData(ENDPOINTS.inventory.post.supplierPrices, payload);
    },
    saveTransfer: async (payload) => {
        await postData(ENDPOINTS.inventory.post.transfers, payload);
        showSuccessModal('Traspaso efectuado exitosamente.');
        // Refrescar AMBAS tablas simultáneamente
        await api.loadStock();
        await api.loadKardex();
    },
    saveAdjustment: async (payload) => {
        await postData(ENDPOINTS.inventory.post.adjustments, payload);
        showSuccessModal('Inventario ajustado correctamente (Merma/Sobrante).');
        await api.loadStock();
        await api.loadKardex();
    },
    syncPurchases: async (payload) => {
        await postData(ENDPOINTS.inventory.post.sync, payload);
        showSuccessModal('Mercancía sincronizada correctamente.');
        await api.loadStock();
        await api.loadKardex();
        await api.loadSuppliers();
    }
};
export const bindEvents = () => {
    // Pestañas (Carga Lazy Caching)
    state.dom.tabs.suppliers.addEventListener('click', () => render.switchTab('suppliers'));
    state.dom.tabs.stock.addEventListener('click', () => {
        render.switchTab('stock');
        api.loadStock();
    });
    state.dom.tabs.kardex.addEventListener('click', () => {
        render.switchTab('kardex');
        api.loadKardex();
    });

    // Filtro Sugerencias
    if (state.dom.toggleSuggested) {
        state.dom.toggleSuggested.addEventListener('change', (e) => {
            state.ui.showOnlySuggested = e.target.checked;
            render.stock();
        });
    }


    // Filtros de Kardex
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

    // Modal de Traspaso (Delegación de Eventos)
    if (state.dom.tbodyStock) {
        state.dom.tbodyStock.addEventListener('click', (e) => {
            const btnT = e.target.closest('.btn-traspasar');
            if (btnT) {
                const code = btnT.getAttribute('data-code');
                const name = btnT.getAttribute('data-name');
                const unit = btnT.getAttribute('data-unit');
                render.modals.transfer.open(code, name, unit);
            }
        });
    }

    if (state.dom.btnTransferClosers) {
        state.dom.btnTransferClosers.forEach(btn => {
            btn.addEventListener('click', () => render.modals.transfer.close());
        });
    }

    // Guardar Traspaso
    bindForm('form-transfer', async () => {
        const targetLoc = state.dom.transTargetLoc.value;
        const qty = parseFloat(state.dom.formTransfer.querySelector('#trans-qty').value);
        const itemCode = state.dom.transItemCode.value;

        if (!targetLoc) throw new Error('Debes seleccionar una ubicación destino.');

        const payload = {
            sourceLocation: 'LOC-BODEGA',   // ← siempre Bodega (único origen de traspasos)
            targetLocation: targetLoc,
            items: [{ itemCode, qty }]
        };

        await api.saveTransfer(payload);
        render.modals.transfer.close();
    });

    // 🟢 Nuevo: Modal de Ajuste Físico (Delegación de Eventos)
    if (state.dom.tbodyStock) {
        state.dom.tbodyStock.addEventListener('click', (e) => {
            const btnA = e.target.closest('.btn-ajustar');
            if (btnA) {
                const code = btnA.getAttribute('data-code');
                const name = btnA.getAttribute('data-name');
                const unit = btnA.getAttribute('data-unit');
                const currentStock = btnA.getAttribute('data-stock') || '0';
                render.modals.adjustment.open(code, name, unit, currentStock);
            }
        });
    }

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

    // Cocina solo tiene ajuste, no traspaso
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


    // 🟢 Nuevo: Guardar Ajuste Físico
    bindForm('form-adjustment', async (e) => {
        const form = e.target;
        const realStock = parseFloat(state.dom.formAdjustment.querySelector('#adj-real-stock').value);
        const itemCode = state.dom.adjItemCode.value;
        const note = state.dom.formAdjustment.querySelector('#adj-note').value.trim();

        if (isNaN(realStock) || realStock < 0) throw new Error("Debes indicar un stock físico válido y positivo.");

        const payload = {
            locationCode: state.ui.stockLocation, // Toma la ubicación actual del filtro
            items: [
                { itemCode: itemCode, realStock: realStock, note: note }
            ]
        };

        await api.saveAdjustment(payload);
        render.modals.adjustment.close();
    });

    // 🟢 Nuevo: Sincronizar Compras PULL
    if (state.dom.btnSyncPurchases) {
        const fileInput = state.dom.btnSyncPurchases.querySelector('#input-sync-purchases');
        
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                const file = e.target.files[0];
                const btn = state.dom.btnSyncPurchases;
                const textSpan = btn.querySelector('.btn-text');
                const iconSpan = btn.querySelector('.btn-icon');
                const originalText = textSpan ? textSpan.textContent : 'Sincronizar Compras a Bodega';

                try {
                    // Estado Visual: Loading
                    btn.style.pointerEvents = 'none';
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                    if (textSpan) textSpan.textContent = 'Sincronizando...';
                    if (iconSpan) iconSpan.classList.add('animate-spin');

                    const textData = await file.text();
                    let payload;
                    try {
                        payload = JSON.parse(textData);
                    } catch (err) {
                        throw new Error('El archivo no tiene un formato JSON válido.');
                    }

                    await api.syncPurchases(payload);
                } catch (error) {
                    console.error("Error PULL Sync:", error);
                    showErrorModal(error.message || "Error conectando con la BD de Compras.", "Fallo de Sincronización");
                } finally {
                    // Restaurar Botón
                    btn.style.pointerEvents = 'auto';
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    if (textSpan) textSpan.textContent = originalText;
                    if (iconSpan) iconSpan.classList.remove('animate-spin');
                    fileInput.value = ''; // Reset
                }
            });
        }
    }

    // Master-Detail Selección
    if (state.dom.listSuppliers) {
        state.dom.listSuppliers.addEventListener('click', (e) => {
            const card = e.target.closest('.supplier-card');
            if (card) {
                state.ui.selectedSupplierCode = card.getAttribute('data-code');
                render.suppliers();
            }
        });
    }

    // Botón + Nuevo
    const btnNewSup = document.querySelector('#btn-new-supplier');
    if (btnNewSup) {
        btnNewSup.addEventListener('click', () => {
            state.ui.selectedSupplierCode = 'NEW';
            state.dom.formSupplierProfile.reset();
            state.dom.formSupplierProfile.querySelector('#sup-code').value = '';
            render.supplierDetail();
        });
    }

    // Buscador Híbrido (Autocompletado)
    if (state.dom.inputLinkCode) {
        state.dom.inputLinkCode.addEventListener('blur', (e) => {
            const code = e.target.value.trim().toUpperCase();
            if (!code) return;
            e.target.value = code;

            const existingItem = state.data.stock.find(item => item.code === code);

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

    // Guardar Perfil del Proveedor
    bindForm('form-inv-supplier', async (e) => {
        const form = e.target;
        const codeInput = form.querySelector('#sup-code');
        const nameInput = form.querySelector('#sup-name');
        const contactInput = form.querySelector('#sup-contact');

        if (!codeInput || !nameInput) throw new Error("Error DOM");

        const payload = {
            code: codeInput.value.trim().toUpperCase(),
            name: nameInput.value.trim(),
            contactName: contactInput ? contactInput.value.trim() : '',
            phone: ''
        };

        await api.saveSupplier(payload);

        // 🟢 SOLUCIÓN AL VIDEO: Anti-Reset
        state.ui.selectedSupplierCode = payload.code;

        // Esperamos 50ms para que formEngine borre todo, y luego re-hidratamos la vista
        setTimeout(() => {
            render.suppliers(); // Repinta la lista izquierda y el detalle derecho
        }, 50);
    });

    // Añadir Producto / Costo
    bindForm('form-supplier-price', async (e) => {
        const form = e.target;
        const inputCode = form.querySelector('#link-item-code');
        const inputName = form.querySelector('#link-item-name');
        const inputPrice = form.querySelector('#link-item-price');

        if (!inputCode || !inputName || !inputPrice) throw new Error("Error DOM");

        const mappedPayload = {
            supplierCode: state.ui.selectedSupplierCode,
            itemCode: inputCode.value.trim().toUpperCase(),
            itemName: inputName.value.trim(),
            itemUnit: state.dom.inputLinkUnit.value,
            price: parseFloat(inputPrice.value)
        };

        // 🟢 LLAMADA REAL A LA BD
        await api.saveSupplierPrice(mappedPayload);

        await api.loadSuppliers();

        // Limpieza de Ráfaga
        state.dom.inputLinkName.readOnly = false;
        state.dom.inputLinkUnit.disabled = false;
        state.dom.inputLinkName.classList.remove('bg-slate-100', 'text-slate-500');
        state.dom.inputLinkUnit.classList.remove('bg-slate-100', 'text-slate-500');

        setTimeout(() => {
            render.supplierDetail(); // 🟢 REPINTA LA TABLA DE PRECIOS
            inputCode.focus();
        }, 50);
    });
};