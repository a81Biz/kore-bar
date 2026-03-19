// frontends/admin/js/views/piso/zonas.js

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { PubSub } from '/shared/js/pubsub.js';

// ==========================================================================
// 2. ESTADO PRIVADO
// ==========================================================================
const state = {
    datos: { lista: [] },
    dom: {}
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const render = {
    cacheDOM: (container) => {
        state.dom.root = container;
        state.dom.form = container.querySelector('#form-piso-zona');
        state.dom.list = container.querySelector('#list-zonas');
        state.dom.template = document.querySelector('#tpl-item-zona');
        // ✅ Cacheamos los inputs del formulario UNA SOLA VEZ
        state.dom.inputCode = container.querySelector('#zona-code');
        state.dom.inputNombre = container.querySelector('#zona-nombre');
    },

    // =========================================================================
    // 4. LÓGICA DE VISTA / RENDERIZADO
    // =========================================================================
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

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS
// ==========================================================================
const logic = {
    cargarDatos: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.zones).catch(() => null);
            const dataRaw = res?.data || res || [];
            state.datos.lista = Array.isArray(dataRaw) ? dataRaw : [];

            render.lista();
            PubSub.publish('ZONAS_ACTUALIZADAS', state.datos.lista);
        } catch (error) {
            showErrorModal('No se pudieron cargar las zonas.');
        }
    },

    crearZona: async () => {
        // ✅ Lee desde los refs cacheados, no con form.querySelector directamente
        const payload = {
            zoneCode: state.dom.inputCode.value.trim().toUpperCase(),
            name: state.dom.inputNombre.value.trim()
        };

        await postData(ENDPOINTS.admin.post.zone, payload);
        showSuccessModal('Zona creada exitosamente.');
        await logic.cargarDatos();
    },

    eliminarZona: async (code, name) => {
        if (!await confirmAction(`¿Borrar la zona "${name}"?`)) return;
        try {
            const url = ENDPOINTS.admin.delete.zone.replace(':code', code);
            await deleteData(url);
            showSuccessModal('Zona eliminada.');
            await logic.cargarDatos();
        } catch (error) {
            showErrorModal(error.message || 'Error al eliminar zona.', 'Denegado');
        }
    }
};

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
const bindEvents = () => {
    if (state.dom.form) bindForm('form-piso-zona', logic.crearZona);

    if (state.dom.list) {
        state.dom.list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="delete-zona"]');
            if (btn) logic.eliminarZona(btn.getAttribute('data-code'), btn.getAttribute('data-name'));
        });
    }
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const ZonasController = {
    mount: async (container) => {
        render.cacheDOM(container);
        bindEvents();
        await logic.cargarDatos();
    },
    getZonas: () => state.datos.lista.filter(z => z.isActive)
};