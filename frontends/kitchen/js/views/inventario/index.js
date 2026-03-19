// frontends/kitchen/js/views/inventario/index.js
import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { PubSub } from '/shared/js/pubsub.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';

// ── ESTADO ────────────────────────────────────────────────────────────────
const state = {
    dom: {
        root:       null,
        tableBody:  null,
        tplRow:     null,
        btnSubmit:  null,
        navButtons: null
    },
    stock: []
};

// ── RENDERIZADO ───────────────────────────────────────────────────────────
const render = {
    cacheDOM: (container) => {
        state.dom.root       = container;
        state.dom.navButtons = container.querySelectorAll('[data-nav]');
        state.dom.tableBody  = container.querySelector('#table-kitchen-stock');
        state.dom.tplRow     = document.querySelector('#tpl-row-kitchen-stock');
        state.dom.btnSubmit  = container.querySelector('#btn-submit-blind');
    },

    stockList: () => {
        state.dom.tableBody.innerHTML = '';
        state.stock.forEach((item, index) => {
            const clon     = state.dom.tplRow.content.cloneNode(true);
            clon.querySelector('.col-name').textContent    = item.itemName;
            clon.querySelector('.col-code').textContent    = item.itemCode;
            clon.querySelector('.col-teorico').textContent = `${item.currentStock} ${item.unit}`;
            clon.querySelector('.col-unit').textContent    = item.unit;

            const inputReal = clon.querySelector('.input-real-stock');
            inputReal.setAttribute('data-index', index);
            // Pre-rellenamos con el teórico para conteo por excepción
            inputReal.value = item.currentStock;

            state.dom.tableBody.appendChild(clon);
        });
    }
};

// ── LÓGICA ────────────────────────────────────────────────────────────────
const logic = {
    loadStock: async () => {
        try {
            // ✅ ENDPOINTS.kitchen.get.kitchenStock ya incluye ?location=LOC-COCINA
            // No se concatena la query string manualmente aquí
            const res  = await fetchData(ENDPOINTS.kitchen.get.kitchenStock);
            state.stock = res.data || [];
            render.stockList();
        } catch (error) {
            showErrorModal('No se pudo cargar el inventario teórico local.', 'Error de Lectura');
        }
    },

    submitBlindInventory: async () => {
        const inputs        = state.dom.tableBody.querySelectorAll('.input-real-stock');
        const itemsToAdjust = [];

        inputs.forEach(input => {
            const realStock = parseFloat(input.value);
            if (!isNaN(realStock)) {
                const item = state.stock[input.getAttribute('data-index')];
                if (item.currentStock !== realStock) {
                    itemsToAdjust.push({
                        itemCode:  item.itemCode,
                        realStock: realStock,
                        note:      'Toma Física: Cuadre de Cierre de Turno en Cocina'
                    });
                }
            }
        });

        if (itemsToAdjust.length === 0) {
            return showSuccessModal(
                'Ningún conteo difiere del sistema.',
                'Inventario Estrictamente Cuadrado'
            );
        }

        if (!await confirmAction(
            `El sistema detectó ${itemsToAdjust.length} insumos con descuadre. ¿Registrar la discrepancia en el Kardex?`
        )) return;

        try {
            state.dom.btnSubmit.disabled    = true;
            state.dom.btnSubmit.textContent = 'Enviando Lote...';

            await postData(ENDPOINTS.inventory.post.adjustments, {
                locationCode: 'LOC-COCINA',
                items:         itemsToAdjust
            });

            showSuccessModal(
                'Tu conteo ciego se reconcilió. El Kardex ha sido consolidado.',
                'Inventario Asentado'
            );
            await logic.loadStock();

        } catch (error) {
            showErrorModal(error.message, 'Fallo de Asentación de Merma');
        } finally {
            state.dom.btnSubmit.disabled    = false;
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

        state.dom.btnSubmit.addEventListener('click', logic.submitBlindInventory);
        await logic.loadStock();
    }
};
