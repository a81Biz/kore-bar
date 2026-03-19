// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { PubSub } from '/shared/js/pubsub.js';
import { ValidatorEngine } from '/shared/js/validationEngine.js';
import { PisoValidationRules } from '../../rules/piso.rules.js';

const state = {
    datos: { mesas: [], zonasActivas: [] },
    dom: { root: null, form: null, selectZonaUnica: null, inputId: null, inputCapacidad: null, list: null, template: null },
    motorValidacion: new ValidatorEngine(PisoValidationRules)
};

const render = {
    cacheDOM: (container) => {
        state.dom.root = container;
        state.dom.form = container.querySelector('#form-piso-mesa');
        state.dom.selectZonaUnica = container.querySelector('#mesa-zona-unica'); // 🟢 Selector Unificado
        state.dom.inputId = container.querySelector('#mesa-id');
        state.dom.inputCapacidad = container.querySelector('#mesa-capacidad');
        state.dom.list = container.querySelector('#list-mesas');
        state.dom.template = document.querySelector('#tpl-item-mesa');
    },

    selectZonas: () => {
        const options = '<option value="" disabled selected>Selecciona una Zona...</option>' +
            state.datos.zonasActivas.map(z => `<option value="${z.zoneCode}">${z.name}</option>`).join('');
        if (state.dom.selectZonaUnica) state.dom.selectZonaUnica.innerHTML = options;
    },

    mesas: () => {
        if (!state.dom.list || !state.dom.template) return;
        state.dom.list.innerHTML = '';

        const filtroCode = state.dom.selectZonaUnica ? state.dom.selectZonaUnica.value : '';

        // Filtrado dinámico por la única zona seleccionada
        const mesasFiltradas = filtroCode ? state.datos.mesas.filter(m => m.zoneCode === filtroCode) : state.datos.mesas;

        mesasFiltradas.forEach(mesa => {
            if (!mesa.isActive) return;
            const clon = state.dom.template.content.cloneNode(true);
            const zonaInfo = state.datos.zonasActivas.find(z => z.zoneCode === mesa.zoneCode);

            clon.querySelector('.code-badge').textContent = mesa.tableId;
            clon.querySelector('.col-detalles').textContent = `Capacidad: ${mesa.capacity} pax`;
            clon.querySelector('.col-zona').textContent = zonaInfo ? zonaInfo.name : mesa.zoneCode;

            const btn = clon.querySelector('.btn-eliminar');
            btn.setAttribute('data-action', 'delete-mesa');
            btn.setAttribute('data-id', mesa.tableId);

            state.dom.list.appendChild(clon);
        });
    }
};

const logic = {
    cargarMesas: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.tables).catch(() => null);
            const arraySeguro = Array.isArray(res?.data) ? res.data : [];

            state.datos.mesas = arraySeguro.map(m => ({ ...m, number: m.tableId }));
            render.mesas();
            PubSub.publish('MESAS_ACTUALIZADAS', state.datos.mesas);
        } catch (error) {
            showErrorModal('No se pudieron cargar las mesas.');
        }
    },

    crearMesa: async () => {
        if (!state.dom.selectZonaUnica.value) {
            showErrorModal('Debes seleccionar una Zona en la parte superior antes de añadir una mesa.', 'Falta Zona');
            throw new Error('Zona no seleccionada');
        }

        const payloadValidacion = {
            action: 'CREATE_TABLE',
            numero: state.dom.inputId.value.trim().toUpperCase(),
            capacidad: parseInt(state.dom.inputCapacidad.value, 10)
        };

        const validacion = state.motorValidacion.execute(payloadValidacion, { tables: state.datos.mesas });
        if (!validacion.isValid) {
            showErrorModal(validacion.error, 'Validación Fallida');
            throw new Error('Validación local fallida');
        }

        const payloadAPI = { tableId: payloadValidacion.numero, zoneCode: state.dom.selectZonaUnica.value, capacity: payloadValidacion.capacidad };
        const zonaGuardada = state.dom.selectZonaUnica.value;

        await postData(ENDPOINTS.admin.post.table, payloadAPI);
        showSuccessModal('Mesa registrada exitosamente.');

        setTimeout(() => {
            state.dom.selectZonaUnica.value = zonaGuardada;
            state.dom.inputId.focus();
        }, 50);

        await logic.cargarMesas();
    },

    eliminarMesa: async (tableId) => {
        if (!await confirmAction(`¿Borrar la mesa ${tableId}?`)) return;
        const url = ENDPOINTS.admin.delete.table.replace(':id', tableId);
        await deleteData(url);
        await logic.cargarMesas();
    }
};

const bindEvents = () => {
    if (state.dom.form) bindForm('form-piso-mesa', logic.crearMesa);

    // 🟢 FIX: Ahora escucha al evento 'change' del selector correcto
    if (state.dom.selectZonaUnica) state.dom.selectZonaUnica.addEventListener('change', render.mesas);

    if (state.dom.list) {
        state.dom.list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="delete-mesa"]');
            if (btn) logic.eliminarMesa(btn.getAttribute('data-id'));
        });
    }
};

export const MesasController = {
    mount: async (container) => {
        render.cacheDOM(container);
        bindEvents();
        await logic.cargarMesas();
    },
    actualizarZonas: (zonas) => {
        // 🟢 FIX: Memorizamos la zona para no perderla al refrescar
        const currentZone = state.dom.selectZonaUnica ? state.dom.selectZonaUnica.value : null;
        state.datos.zonasActivas = zonas;
        render.selectZonas();
        if (currentZone && state.dom.selectZonaUnica) state.dom.selectZonaUnica.value = currentZone;
        render.mesas();
    }
};