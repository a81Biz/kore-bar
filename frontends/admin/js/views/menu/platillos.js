// frontends/admin/js/views/menu/platillos.js

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, confirmAction } from '/shared/js/ui.js';
import { ValidatorEngine } from '/shared/js/validationEngine.js';
import { MenuValidationRules } from '../../rules/menu.rules.js';

// ==========================================================================
// 2. ESTADO PRIVADO
// ==========================================================================
const state = {
    datos: { platillos: [], categoriasActivas: [], dishActual: null, currentImageBase64: null },
    dom: {
        root: null, form: null, list: null, template: null,
        selectFiltro: null, selectForm: null,
        inputCode: null, inputName: null, inputDesc: null, inputPrice: null,
        
        // Drawer de Revisión Comercial
        modalReview: null, drawerReview: null, btnCloseReview: null,
        tabComercial: null, tabTecnica: null,
        viewComercial: null, viewTecnica: null, formReview: null,
        revCode: null, revName: null, revCategory: null, revDesc: null, revPrice: null, revActive: null,
        revImgUpload: null, revImgPreview: null, revImgPlaceholder: null,
        revTechMethod: null, revBomList: null, revBomEmpty: null
    },
    motorValidacion: new ValidatorEngine(MenuValidationRules),
    // Configuración UI para formateo de moneda sin lógica espagueti
    formatter: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
};

const _uiConfig = {
    recetaStatus: {
        true: { css: 'bg-emerald-100 text-emerald-800', icon: 'check_circle', text: 'Con Receta' },
        false: { css: 'bg-amber-100 text-amber-800', icon: 'warning', text: 'Sin Receta' }
    }
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const render = {
    cacheDOM: (container) => {
        state.dom.root = container;
        state.dom.form = container.querySelector('#form-menu-platillo');
        state.dom.list = container.querySelector('#list-platillos');
        state.dom.template = document.querySelector('#tpl-item-platillo');

        state.dom.selectFiltro = container.querySelector('#filtro-platillo-categoria');
        state.dom.selectForm = container.querySelector('#plat-category');

        state.dom.inputCode = container.querySelector('#plat-code');
        state.dom.inputName = container.querySelector('#plat-name');
        state.dom.inputDesc = container.querySelector('#plat-desc');
        state.dom.inputPrice = container.querySelector('#plat-price');

        // Drawer Comercial
        state.dom.modalReview = container.querySelector('#modal-dish-review');
        state.dom.drawerReview = container.querySelector('#drawer-dish-review');
        state.dom.btnCloseReview = container.querySelectorAll('.btn-close-review');
        state.dom.tabComercial = container.querySelector('#tab-review-comercial');
        state.dom.tabTecnica = container.querySelector('#tab-review-tecnica');
        state.dom.viewComercial = container.querySelector('#form-review-comercial');
        state.dom.viewTecnica = container.querySelector('#view-review-tecnica');
        state.dom.formReview = container.querySelector('#form-review-comercial');
        
        state.dom.revCode = container.querySelector('#rev-code');
        state.dom.revName = container.querySelector('#rev-name');
        state.dom.revCategory = container.querySelector('#rev-category');
        state.dom.revDesc = container.querySelector('#rev-desc');
        state.dom.revPrice = container.querySelector('#rev-price');
        state.dom.revActive = container.querySelector('#rev-active');
        state.dom.revImgUpload = container.querySelector('#rev-img-upload');
        state.dom.revImgPreview = container.querySelector('#rev-img-preview');
        state.dom.revImgPlaceholder = container.querySelector('#rev-img-placeholder');
        
        state.dom.revTechMethod = container.querySelector('#rev-tech-method');
        state.dom.revBomList = container.querySelector('#rev-bom-list');
        state.dom.revBomEmpty = container.querySelector('#rev-bom-empty');
    },

    // ==========================================================================
    // 4. LÓGICA DE VISTA (RENDER)
    // ==========================================================================
    selects: () => {
        if (state.dom.selectForm) {
            state.dom.selectForm.textContent = '';
            state.dom.revCategory.textContent = ''; // Llenamos de una vez el Drawer
            state.dom.selectForm.appendChild(new Option('Selecciona Categoría...', '', true, true)).disabled = true;
            state.datos.categoriasActivas.forEach(c => {
                state.dom.selectForm.appendChild(new Option(c.name, c.categoryCode));
                state.dom.revCategory.appendChild(new Option(c.name, c.categoryCode));
            });
        }
        if (state.dom.selectFiltro) {
            const currentFilter = state.dom.selectFiltro.value;
            state.dom.selectFiltro.textContent = '';
            state.dom.selectFiltro.appendChild(new Option('Filtrar por Categoría...', '', true, true)).disabled = true;
            state.dom.selectFiltro.appendChild(new Option('Mostrar Todos', 'ALL'));
            state.datos.categoriasActivas.forEach(c => {
                state.dom.selectFiltro.appendChild(new Option(c.name, c.categoryCode));
            });
            if (currentFilter) state.dom.selectFiltro.value = currentFilter;
        }
    },

    platillos: () => {
        if (!state.dom.list || !state.dom.template) return;
        state.dom.list.innerHTML = '';

        const filtroCat = state.dom.selectFiltro ? state.dom.selectFiltro.value : 'ALL';

        const filtrados = (filtroCat === 'ALL' || !filtroCat)
            ? state.datos.platillos
            : state.datos.platillos.filter(p => p.categoryCode === filtroCat);

        filtrados.forEach(plat => {
            if (!plat.isActive) return;

            const clon = state.dom.template.content.cloneNode(true);
            clon.querySelector('.col-categoria').textContent = plat.categoryName || plat.categoryCode;
            clon.querySelector('.col-nombre').textContent = plat.name;
            clon.querySelector('.col-desc').textContent = plat.description || '';
            clon.querySelector('.col-precio').textContent = state.formatter.format(plat.price);

            const uiReceta = _uiConfig.recetaStatus[plat.hasRecipe === true] || _uiConfig.recetaStatus[false];
            const badgeReceta = clon.querySelector('.col-receta-status');
            badgeReceta.classList.add(...uiReceta.css.split(' '));
            badgeReceta.textContent = '';
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-symbols-outlined text-[12px]';
            iconSpan.textContent = uiReceta.icon;
            badgeReceta.appendChild(iconSpan);
            badgeReceta.appendChild(document.createTextNode(` ${uiReceta.text}`));

            const btnEliminar = clon.querySelector('.btn-eliminar');
            btnEliminar.setAttribute('data-action', 'delete-platillo');
            btnEliminar.setAttribute('data-id', plat.dishCode);

            const btnEditar = clon.querySelector('.btn-editar');
            btnEditar.setAttribute('data-action', 'review-platillo');
            btnEditar.setAttribute('data-id', plat.dishCode);

            state.dom.list.appendChild(clon);
        });
    },

    // UI: Pestañas del Modal
    switchReviewTab: (isComercial) => {
        state.dom.tabComercial.className = isComercial ? 'py-3 px-4 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition-colors' : 'py-3 px-4 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors';
        state.dom.tabTecnica.className = !isComercial ? 'py-3 px-4 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition-colors' : 'py-3 px-4 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors';
        
        state.dom.viewComercial.classList.toggle('hidden', !isComercial);
        state.dom.viewTecnica.classList.toggle('hidden', isComercial);
        
        const footerActions = state.dom.modalReview.querySelector('#review-footer-actions');
        if (footerActions) footerActions.classList.toggle('hidden', !isComercial);
    },

    // UI: Abrir el Drawer poblando datos
    openDrawer: (plat) => {
        state.datos.dishActual = plat;
        state.datos.currentImageBase64 = null;
        
        // Tab Textos y Títulos
        state.dom.modalReview.querySelector('#review-dish-title').textContent = plat.name;
        state.dom.modalReview.querySelector('#review-dish-subtitle').textContent = `ID Comercial: ${plat.dishCode}`;
        
        // Tab de Marketing
        state.dom.revCode.value = plat.dishCode;
        state.dom.revName.value = plat.name;
        state.dom.revCategory.value = plat.categoryCode;
        state.dom.revDesc.value = plat.description || '';
        state.dom.revPrice.value = plat.price;
        state.dom.revActive.checked = plat.isActive;

        // Foto actual (Cocinero o de Estudio)
        if (plat.imageUrl) {
            state.dom.revImgPreview.src = plat.imageUrl;
            state.dom.revImgPreview.classList.remove('hidden');
            state.dom.revImgPlaceholder.classList.add('hidden');
        } else {
            state.dom.revImgPreview.src = '';
            state.dom.revImgPreview.classList.add('hidden');
            state.dom.revImgPlaceholder.classList.remove('hidden');
        }

        // Tab Técnico (Metodología del Chef)
        state.dom.revTechMethod.textContent = plat.preparationMethod || "La cocina no redactó método de preparación.";

        render.switchReviewTab(true);

        // Animaciones CSS Tailwind para Drawer
        state.dom.modalReview.classList.remove('hidden');
        requestAnimationFrame(() => {
            state.dom.modalReview.classList.remove('opacity-0');
            state.dom.drawerReview.classList.remove('translate-x-full');
        });
    },

    closeDrawer: () => {
        state.dom.modalReview.classList.add('opacity-0');
        state.dom.drawerReview.classList.add('translate-x-full');
        setTimeout(() => {
            state.dom.modalReview.classList.add('hidden');
            state.dom.formReview.reset();
            state.dom.revBomList.innerHTML = '';
            state.datos.dishActual = null;
        }, 300);
    },

    renderBom: (bomArray) => {
        state.dom.revBomList.innerHTML = '';
        if (!bomArray || bomArray.length === 0) {
            state.dom.revBomEmpty.classList.remove('hidden');
            return;
        }
        state.dom.revBomEmpty.classList.add('hidden');
        
        bomArray.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-3 align-top">
                    <div class="font-bold text-slate-800">${item.name}</div>
                    <div class="text-[10px] text-slate-400 font-mono mt-0.5">${item.code}</div>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">${item.qty} ${item.unit}</span>
                </td>
            `;
            state.dom.revBomList.appendChild(tr);
        });
    }
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO
// ==========================================================================
const logic = {
    cargarCategorias: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.menuCategories).catch(() => null);
            state.datos.categoriasActivas = (res?.data || []).filter(c => c.isActive);
            render.selects();
        } catch (error) { /* Silencioso, manejado globalmente */ }
    },

    cargarPlatillos: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.menuDishes);
            state.datos.platillos = Array.isArray(res?.data) ? res.data : [];
            render.platillos();
        } catch (error) {
            console.error('[Menú] Error cargando platillos', error);
        }
    },

    crearPlatillo: async () => {
        const payloadValidacion = {
            action: 'CREATE_DISH',
            code: state.dom.inputCode.value.trim().toUpperCase(),
            price: state.dom.inputPrice.value
        };

        const validacion = state.motorValidacion.execute(payloadValidacion, { dishes: state.datos.platillos });
        if (!validacion.isValid) throw new Error(validacion.error);

        const payloadAPI = {
            dishCode: payloadValidacion.code,
            categoryCode: state.dom.selectForm.value,
            name: state.dom.inputName.value.trim(),
            description: state.dom.inputDesc.value.trim(),
            price: parseFloat(payloadValidacion.price)
        };

        // Regla Ráfaga de Captura: Conservamos categoría
        const savedCategory = state.dom.selectForm.value;

        await postData(ENDPOINTS.admin.post.menuDish, payloadAPI);
        showSuccessModal('Platillo añadido al menú.');

        setTimeout(() => {
            state.dom.selectForm.value = savedCategory;
            state.dom.inputCode.focus();
        }, 50);

        await logic.cargarPlatillos();
    },

    eliminarPlatillo: async (code) => {
        if (!await confirmAction(`¿Eliminar el platillo ${code}?`)) return;
        const url = ENDPOINTS.admin.delete.menuDish.replace(':code', code);
        await deleteData(url);
        await logic.cargarPlatillos();
    },

    cargarBomLectura: async (dishCode) => {
        render.renderBom([]); // Limpiar previo
        try {
            // Re-usamos el endpoint analítico de la cocina en modo Solo Lectura para Admin
            const res = await fetchData(ENDPOINTS.kitchen.get.recipeBOM.replace(':dishCode', dishCode));
            render.renderBom(res.data);
        } catch (error) {
            console.warn('[Menú] Error recuperando receta matemática por el candado', error);
        }
    },

    iniciarRevisionComercial: async (code) => {
        const platillo = state.datos.platillos.find(p => p.dishCode === code);
        if (!platillo) return;
        
        render.openDrawer(platillo);
        if (platillo.hasRecipe) {
            await logic.cargarBomLectura(code);
        } else {
            render.renderBom([]);
        }
    },

    guardarRevisionComercial: async () => {
        if (!state.datos.dishActual) return;
        const plat = state.datos.dishActual;

        const payloadAPI = {
            categoryCode: state.dom.revCategory.value,
            name: state.dom.revName.value.trim(),
            description: state.dom.revDesc.value.trim(),
            price: parseFloat(state.dom.revPrice.value),
            isActive: state.dom.revActive.checked,
            imageUrl: state.datos.currentImageBase64 || plat.imageUrl || '' // Consolidamos foto
        };

        const url = ENDPOINTS.admin.put.menuDish.replace(':code', plat.dishCode);
        await putData(url, payloadAPI);
        showSuccessModal('Marketing del platillo actualizado exitosamente. El Kardex sigue intacto.', 'Revisión Comercial Guardada');
        
        render.closeDrawer();
        await logic.cargarPlatillos();
    }
};

// ==========================================================================
// 6. EVENTOS (DELEGACIÓN)
// ==========================================================================
const bindEvents = () => {
    if (state.dom.form) bindForm('form-menu-platillo', logic.crearPlatillo);
    if (state.dom.selectFiltro) state.dom.selectFiltro.addEventListener('change', render.platillos);

    if (state.dom.list) {
        state.dom.list.addEventListener('click', (e) => {
            const btnEliminar = e.target.closest('button[data-action="delete-platillo"]');
            if (btnEliminar) return logic.eliminarPlatillo(btnEliminar.getAttribute('data-id'));

            const btnRevisar = e.target.closest('button[data-action="review-platillo"]');
            if (btnRevisar) return logic.iniciarRevisionComercial(btnRevisar.getAttribute('data-id'));
        });
    }

    // Eventos del Drawer de Revisión Comercial
    if (state.dom.btnCloseReview) {
        state.dom.btnCloseReview.forEach(btn => btn.addEventListener('click', render.closeDrawer));
    }
    
    if (state.dom.tabComercial) state.dom.tabComercial.addEventListener('click', () => render.switchReviewTab(true));
    if (state.dom.tabTecnica) state.dom.tabTecnica.addEventListener('click', () => render.switchReviewTab(false));

    if (state.dom.formReview) bindForm('form-review-comercial', logic.guardarRevisionComercial);

    // Carga fotográfica WebP
    if (state.dom.revImgUpload) {
        state.dom.revImgUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                // Requiere compresión dinámica, asimilamos de Utils global
                const { compressImageToWebP } = await import('/shared/js/utils.js');
                const webpBase64 = await compressImageToWebP(file, 800, 0.75);
                state.datos.currentImageBase64 = webpBase64;
                state.dom.revImgPreview.src = webpBase64;
                state.dom.revImgPreview.classList.remove('hidden');
                state.dom.revImgPlaceholder.classList.add('hidden');
            } catch (error) {
                console.error(error);
                showErrorModal('Error al procesar la imagen publicitaria.');
            }
        });
    }
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const PlatillosController = {
    mount: async (container) => {
        render.cacheDOM(container);
        bindEvents();
        await logic.cargarCategorias();
        await logic.cargarPlatillos();
    },
    // Invocado por el orquestador (PubSub)
    actualizarCategorias: async () => {
        await logic.cargarCategorias();
        render.platillos();
    }
};