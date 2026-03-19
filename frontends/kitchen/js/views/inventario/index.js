import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { PubSub } from '/shared/js/pubsub.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';

const state = {
    dom: { root: null, tableBody: null, tplRow: null, btnSubmit: null, navButtons: null },
    stock: []
};

const render = {
    cacheDOM: (container) => {
        state.dom.root = container;
        state.dom.navButtons = container.querySelectorAll('[data-nav]');
        state.dom.tableBody = container.querySelector('#table-kitchen-stock');
        state.dom.tplRow = document.querySelector('#tpl-row-kitchen-stock');
        state.dom.btnSubmit = container.querySelector('#btn-submit-blind');
    },
    stockList: () => {
        state.dom.tableBody.innerHTML = '';
        state.stock.forEach((item, index) => {
            const clon = state.dom.tplRow.content.cloneNode(true);
            clon.querySelector('.col-name').textContent = item.itemName;
            clon.querySelector('.col-code').textContent = item.itemCode;
            clon.querySelector('.col-teorico').textContent = `${item.currentStock} ${item.unit}`;
            clon.querySelector('.col-unit').textContent = item.unit;
            
            const inputReal = clon.querySelector('.input-real-stock');
            inputReal.setAttribute('data-index', index);
            // Pre-rellenamos con el inventario teórico para agilizar la toma (conteo por excepción)
            inputReal.value = item.currentStock;
            
            state.dom.tableBody.appendChild(clon);
        });
    }
};

const logic = {
    loadStock: async () => {
        try {
            // Fase 5: Consultar única y exclusivamente las existencias de la Cocina
            const res = await fetchData(`${ENDPOINTS.inventory.get.stock}?location=LOC-COCINA`);
            state.stock = res.data || [];
            render.stockList();
        } catch (error) {
            showErrorModal('No se pudo cargar el inventario teórico local.', 'Error de Lectura');
        }
    },
    submitBlindInventory: async () => {
        const inputs = state.dom.tableBody.querySelectorAll('.input-real-stock');
        const itemsToAdjust = [];
        
        inputs.forEach(input => {
            const realStock = parseFloat(input.value);
            if (!isNaN(realStock)) {
                const item = state.stock[input.getAttribute('data-index')];
                // Cruce del Teórico (Diferencia = Merma pre-calculada por el Backend)
                if (item.currentStock !== realStock) {
                    itemsToAdjust.push({
                        itemCode: item.itemCode,
                        realStock: realStock,
                        note: "Toma Física Fase 5: Cuadre de Cierre de Turno en Cocina"
                    });
                }
            }
        });

        if (itemsToAdjust.length === 0) {
            return showSuccessModal('Ningún conteo de báscula difiere de la memoria RAM del sistema.', 'Inventario Estrictamente Cuadrado');
        }

        if (!await confirmAction(`El sistema detectó ${itemsToAdjust.length} insumos con descuadre. ¿Registrar la discrepancia (Mermas/Sobrantes) en el Kardex Operativo?`)) return;

        try {
            state.dom.btnSubmit.disabled = true;
            state.dom.btnSubmit.textContent = 'Enviando Lote...';
            await postData(ENDPOINTS.inventory.post.adjustments, {
                locationCode: 'LOC-COCINA',
                items: itemsToAdjust
            });
            showSuccessModal('Tu conteo ciego se reconcilió. El Kardex del Restaurante ha sido consolidado y el Administrador puede revisar las variaciones.', 'Inventario Asentado');
            await logic.loadStock();
        } catch (error) {
            showErrorModal(error.message, 'Fallo de Asentación de Merma');
        } finally {
            state.dom.btnSubmit.disabled = false;
            state.dom.btnSubmit.textContent = 'Registrar Mermas y Cerrar Turno';
        }
    }
};

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
