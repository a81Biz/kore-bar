import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js'; // 🟢 USO ESTRICTO
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { PubSub } from '/shared/js/pubsub.js';

// 🟢 ESTANDARIZACIÓN DE OBJETOS AL PATRÓN EMPLEADOS
const state = {
    datos: { lista: [] },
    dom: {}
};

const render = {
    cacheDOM: (container) => {
        state.dom.root = container;
        state.dom.form = container.querySelector('#form-piso-zona');
        state.dom.list = container.querySelector('#list-zonas');
        state.dom.template = document.querySelector('#tpl-item-zona');
    },
    lista: () => {
        if (!state.dom.list || !state.dom.template) return;
        state.dom.list.innerHTML = '';

        state.datos.lista.forEach(zona => {
            if (!zona.isActive) return;
            const clon = state.dom.template.content.cloneNode(true);

            clon.querySelector('.code-badge').textContent = zona.zoneCode;
            clon.querySelector('.col-nombre').textContent = zona.name;

            const btn = clon.querySelector('.btn-eliminar');
            btn.setAttribute('data-action', 'delete-zona');
            btn.setAttribute('data-code', zona.zoneCode);
            btn.setAttribute('data-name', zona.name);

            state.dom.list.appendChild(clon);
        });
    }
};

const logic = {
    cargarDatos: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.zones).catch(() => null);
            // BLINDAJE: Si res.data existe y es array lo usamos, si no, array vacío estricto.
            const dataRaw = res?.data || res || [];
            state.datos.lista = Array.isArray(dataRaw) ? dataRaw : [];

            render.lista();
            PubSub.publish('ZONAS_ACTUALIZADAS', state.datos.lista);
        } catch (error) {
            showErrorModal('No se pudieron cargar las zonas.');
        }
    },
    crearZona: async () => {
        const inputCode = state.dom.form.querySelector('#zona-code');
        const inputName = state.dom.form.querySelector('#zona-nombre');

        const payload = {
            zoneCode: inputCode.value.trim().toUpperCase(),
            name: inputName.value.trim()
        };

        // 🟢 CONSUMO DE ENDPOINTS
        await postData(ENDPOINTS.admin.post.zone, payload);
        showSuccessModal('Zona creada exitosamente.');

        inputCode.value = ''; inputName.value = ''; inputCode.focus();
        await logic.cargarDatos();
    },
    eliminarZona: async (code, name) => {
        if (!await confirmAction(`¿Borrar la zona "${name}"?`)) return;
        try {
            // 🟢 REEMPLAZO DINÁMICO DE RUTA
            const url = ENDPOINTS.admin.delete.zone.replace(':code', code);
            await deleteData(url);
            showSuccessModal('Zona eliminada.');
            await logic.cargarDatos();
        } catch (error) {
            showErrorModal(error.message || 'Error al eliminar zona.', 'Denegado');
        }
    }
};

const bindEvents = () => {
    if (state.dom.form) bindForm('form-piso-zona', logic.crearZona);
    if (state.dom.list) {
        state.dom.list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="delete-zona"]');
            if (btn) logic.eliminarZona(btn.getAttribute('data-code'), btn.getAttribute('data-name'));
        });
    }
};

export const ZonasController = {
    mount: async (container) => {
        render.cacheDOM(container);
        bindEvents();
        await logic.cargarDatos();
    },
    getZonas: () => state.datos.lista.filter(z => z.isActive)
};