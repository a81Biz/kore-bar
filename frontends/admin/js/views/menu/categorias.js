// frontends/admin/js/views/menu/categorias.js

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { PubSub } from '/shared/js/pubsub.js';
import { ValidatorEngine } from '/shared/js/validationEngine.js';
import { MenuValidationRules } from '../../rules/menu.rules.js';

// ==========================================================================
// 2. ESTADO PRIVADO
// ==========================================================================
const state = {
    datos: { categorias: [] },
    dom: { root: null, form: null, list: null, template: null, inputCode: null, inputName: null, inputDesc: null },
    motorValidacion: new ValidatorEngine(MenuValidationRules)
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const render = {
    cacheDOM: (container) => {
        state.dom.root = container;
        state.dom.form = container.querySelector('#form-menu-categoria');
        state.dom.list = container.querySelector('#list-categorias');
        state.dom.template = document.querySelector('#tpl-item-categoria');

        state.dom.inputCode = container.querySelector('#cat-code');
        state.dom.inputName = container.querySelector('#cat-name');
        state.dom.inputDesc = container.querySelector('#cat-desc');
    },

    // ==========================================================================
    // 4. LÓGICA DE VISTA (RENDER)
    // ==========================================================================
    categorias: () => {
        if (!state.dom.list || !state.dom.template) return;
        state.dom.list.innerHTML = '';

        state.datos.categorias.forEach(cat => {
            if (!cat.isActive) return;

            const clon = state.dom.template.content.cloneNode(true);
            clon.querySelector('.code-badge').textContent = cat.categoryCode;
            clon.querySelector('.col-nombre').textContent = cat.name;
            clon.querySelector('.col-desc').textContent = cat.description || '';

            const btnEliminar = clon.querySelector('.btn-eliminar');
            btnEliminar.setAttribute('data-action', 'delete-categoria');
            btnEliminar.setAttribute('data-id', cat.categoryCode);

            state.dom.list.appendChild(clon);
        });
    }
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO
// ==========================================================================
const logic = {
    cargarCategorias: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.menuCategories);
            state.datos.categorias = Array.isArray(res?.data) ? res.data : [];
            render.categorias();
            // Avisar al orquestador que tenemos nuevas categorías
            PubSub.publish('CATEGORIAS_ACTUALIZADAS', state.datos.categorias);
        } catch (error) {
            console.error('[Menú] Error cargando categorías', error);
        }
    },

    crearCategoria: async () => {
        const payloadValidacion = {
            action: 'CREATE_CATEGORY',
            code: state.dom.inputCode.value.trim().toUpperCase()
        };

        const validacion = state.motorValidacion.execute(payloadValidacion, { categories: state.datos.categorias });
        if (!validacion.isValid) throw new Error(validacion.error);

        const payloadAPI = {
            categoryCode: payloadValidacion.code,
            name: state.dom.inputName.value.trim(),
            description: state.dom.inputDesc.value.trim()
        };

        await postData(ENDPOINTS.admin.post.menuCategory, payloadAPI);
        showSuccessModal('Categoría guardada exitosamente.');
        await logic.cargarCategorias();
    },

    eliminarCategoria: async (code) => {
        if (!await confirmAction(`¿Eliminar la categoría ${code}?`)) return;
        const url = ENDPOINTS.admin.delete.menuCategory.replace(':code', code);
        await deleteData(url);
        await logic.cargarCategorias();
    }
};

// ==========================================================================
// 6. EVENTOS (DELEGACIÓN)
// ==========================================================================
const bindEvents = () => {
    if (state.dom.form) bindForm('form-menu-categoria', logic.crearCategoria);

    if (state.dom.list) {
        state.dom.list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="delete-categoria"]');
            if (btn) logic.eliminarCategoria(btn.getAttribute('data-id'));
        });
    }
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const CategoriasController = {
    mount: async (container) => {
        render.cacheDOM(container);
        bindEvents();
        await logic.cargarCategorias();
    }
};