import { bindForm } from '/shared/js/formEngine.js';
import { state } from './empleados/state.js';
import { render } from './empleados/view.js';
import { logic } from './empleados/logic.js';

// ==========================================================================
// CACHÉ DEL DOM
// ==========================================================================
const cacheDOM = (container) => {
    state.dom.root = container;
    state.dom.tbody = container.querySelector('#table-empleados-body');
    state.dom.formSync = container.querySelector('#form-hr-sync');
    state.dom.inputUrlSync = container.querySelector('#input-hr-url');
    state.dom.btnSync = container.querySelector('#btn-hr-sync');

    state.dom.statsContainer = container.querySelector('#mdm-stats-container');
    state.dom.statSaved = container.querySelector('#stat-saved');
    state.dom.statPending = container.querySelector('#stat-pending');
    state.dom.statOrphan = container.querySelector('#stat-orphan');
    state.dom.btnSaveAll = container.querySelector('#btn-save-all');
    state.dom.statPendingBtn = container.querySelector('#stat-pending-btn');

    let modalNode = document.getElementById('modal-edit-empleado');
    if (!modalNode) {
        const modalTemplate = document.getElementById('tpl-modal-empleado');
        if (modalTemplate) {
            document.body.appendChild(modalTemplate.content.cloneNode(true));
            modalNode = document.getElementById('modal-edit-empleado');
        }
    }

    state.dom.modalEdit = modalNode;
    if (modalNode) {
        state.dom.formEdit = modalNode.querySelector('#form-edit-empleado');
        state.dom.inputEditId = modalNode.querySelector('#edit-emp-numero');
        state.dom.inputEditNombre = modalNode.querySelector('#edit-emp-nombre');
        state.dom.inputEditApellidos = modalNode.querySelector('#edit-emp-apellidos');
        state.dom.selectEditArea = modalNode.querySelector('#edit-emp-area');
        state.dom.selectEditPuesto = modalNode.querySelector('#edit-emp-puesto');
        state.dom.checkEditActive = modalNode.querySelector('#edit-emp-active');
        state.dom.btnSubmitEdit = modalNode.querySelector('#btn-submit-edit');
    }
};

// ==========================================================================
// EVENTOS (Delegación)
// ==========================================================================
// FIX: recibe container como parámetro para que el querySelector funcione
const bindEvents = (container) => {
    if (state.dom.modalEdit) {
        state.dom.modalEdit.querySelectorAll('.btn-close-modal').forEach(btn =>
            btn.addEventListener('click', render.modalClose)
        );
    }

    if (state.dom.selectEditArea) {
        state.dom.selectEditArea.addEventListener('change', (e) => render.puestos(e.target.value));
    }

    // FIX: container ahora está disponible como parámetro
    const listAreas = container.querySelector('#list-areas-cashier');
    if (listAreas) {
        listAreas.addEventListener('change', async (e) => {
            const toggle = e.target.closest('.toggle-cashier');
            if (toggle) {
                await logic.toggleCashierAccess(
                    toggle.dataset.code,
                    toggle.dataset.name,
                    toggle.checked
                );
            }
        });
    }

    // FIX: interceptar el submit para evitar recarga de página
    if (state.dom.formSync) {
        state.dom.formSync.addEventListener('submit', async (e) => {
            e.preventDefault();
            const originalHtml = state.dom.btnSync.innerHTML;
            state.dom.btnSync.innerHTML = '⏳ Sincronizando...';
            state.dom.btnSync.disabled = true;
            try {
                await logic.syncHR();
            } finally {
                state.dom.btnSync.innerHTML = originalHtml;
                state.dom.btnSync.disabled = false;
            }
        });
    }

    if (state.dom.formEdit) bindForm('form-edit-empleado', logic.guardarEdicion);
    if (state.dom.btnSaveAll) state.dom.btnSaveAll.addEventListener('click', logic.guardarTodosPendientes);

    if (state.dom.tbody) {
        state.dom.tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'abrir-modal-editar') logic.prepararEdicion(btn.dataset.id);
        });
    }

    // Botón refresh áreas cashier
    const btnRefreshAreas = container.querySelector('#btn-refresh-areas');
    if (btnRefreshAreas) {
        btnRefreshAreas.addEventListener('click', logic.loadAreas);
    }
};

// ==========================================================================
// API PÚBLICA
// ==========================================================================
export const mount = async (container) => {
    cacheDOM(container);
    bindEvents(container);   // FIX: pasar container
    await logic.loadAll();
    await logic.loadAreas(); // FIX: llamar desde logic, no como función suelta
};