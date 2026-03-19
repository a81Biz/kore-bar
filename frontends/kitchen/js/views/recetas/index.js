// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { PubSub } from '/shared/js/pubsub.js';
import { RecetasRules } from './rules/recetas.rules.js';
import { showSuccessModal, showErrorModal } from '/shared/js/ui.js';
import { compressImageToWebP } from '/shared/js/utils.js';

// ==========================================================================
// 2. ESTADO PRIVADO Y CONFIGURACIÓN
// ==========================================================================
const state = {
    dom: {},
    data: {
        pendientes: [],
        terminados: [], // R-UI-REC-04: Recetario Histórico
        insumosCache: [],
        activeDish: null,
        activeTechDish: null,
        recetaActual: [],
        currentImageBase64: null // Cache temporal de la foto
    }
};

// ==========================================================================
// 3. CACHÉ DEL DOM (Privado)
// ==========================================================================
const _cacheDOM = (container) => {
    state.dom.root = container;
    state.dom.navButtons = container.querySelectorAll('[data-nav]');

    // Pestañas (Tabs)
    state.dom.tabPending = container.querySelector('#tab-pending');
    state.dom.tabFinished = container.querySelector('#tab-finished');

    // Listas (Columna 1)
    state.dom.listPending = container.querySelector('#list-pending-dishes');
    state.dom.listFinished = container.querySelector('#list-finished-dishes');
    state.dom.counterMissingBom = container.querySelector('#counter-missing-bom');
    state.dom.counterMissingTech = container.querySelector('#counter-missing-tech');
    state.dom.tplPending = document.querySelector('#tpl-item-pending');

    // Vistas (Columna 2)
    state.dom.viewBomBuilder = container.querySelector('#view-bom-builder');
    state.dom.viewTechSheet = container.querySelector('#view-tech-sheet');

    // Laboratorio BOM (Vista A)
    state.dom.activeDishName = container.querySelector('#active-dish-name');
    state.dom.form = container.querySelector('#form-kitchen-ingredient');
    state.dom.ingCode = container.querySelector('#ing-code');
    state.dom.ingName = container.querySelector('#ing-name');
    state.dom.ingUnit = container.querySelector('#ing-unit');
    state.dom.ingQty = container.querySelector('#ing-qty');
    state.dom.datalistCodes = container.querySelector('#datalist-codes');
    state.dom.datalistNames = container.querySelector('#datalist-names');
    state.dom.btnAdd = container.querySelector('#btn-add-ingredient');
    state.dom.tableBody = container.querySelector('#table-recipe-body');
    state.dom.tplRow = document.querySelector('#tpl-row-recipe');
    state.dom.btnFinish = container.querySelector('#btn-finish-recipe');

    // Ficha Técnica (Vista B)
    state.dom.formTech = container.querySelector('#form-tech-sheet');
    state.dom.techDishName = container.querySelector('#tech-dish-name');
    state.dom.techImgUpload = container.querySelector('#tech-img-upload');
    state.dom.techImgPreview = container.querySelector('#tech-img-preview');
    state.dom.techImgPlaceholder = container.querySelector('#tech-img-placeholder');
    state.dom.techBomList = container.querySelector('#tech-bom-list');
    state.dom.techPrepMethod = container.querySelector('#tech-prep-method');
    state.dom.btnSaveTech = container.querySelector('#btn-save-tech');
};

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO (Privado)
// ==========================================================================
const _render = {
    // Gestor de Pestañas
    switchTab: (tabName) => {
        const isPending = tabName === 'pending';

        // Estilos de pestañas
        state.dom.tabPending.className = isPending ? 'flex-1 py-4 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 bg-white transition-colors' : 'flex-1 py-4 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors';
        state.dom.tabFinished.className = !isPending ? 'flex-1 py-4 text-sm font-bold border-b-2 border-emerald-600 text-emerald-600 bg-white transition-colors' : 'flex-1 py-4 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors';

        // Alternar Listas
        state.dom.listPending.classList.toggle('hidden', !isPending);
        state.dom.listFinished.classList.toggle('hidden', isPending);

        // Alternar Vistas (Columna 2)
        state.dom.viewBomBuilder.classList.toggle('hidden', !isPending);
        state.dom.viewTechSheet.classList.toggle('hidden', isPending);
    },

    pendingList: () => {
        state.dom.listPending.innerHTML = '';
        state.dom.counterMissingBom.textContent = state.data.pendientes.length;

        if (state.data.pendientes.length === 0) {
            state.dom.listPending.textContent = '';
            const emptyLi = document.createElement('li');
            emptyLi.className = 'p-4 text-center text-slate-400 text-sm';
            emptyLi.textContent = 'No hay platillos pendientes.';
            state.dom.listPending.appendChild(emptyLi);
            return;
        }

        state.data.pendientes.forEach(dish => {
            const clone = state.dom.tplPending.content.cloneNode(true);
            clone.querySelector('.col-categoria').textContent = dish.categoryName || 'Sin Categoría';
            clone.querySelector('.col-nombre').textContent = dish.name;
            clone.querySelector('.col-codigo').textContent = dish.dishCode;

            // 🟢 UX: Insignia clara para la falta de BOM
            const badgeEstado = clone.querySelector('.bg-amber-100');
            badgeEstado.className = 'bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded';
            badgeEstado.textContent = 'Faltan Insumos';

            const li = clone.querySelector('li');
            li.addEventListener('click', () => _actions.selectPendingDish(dish, li));
            state.dom.listPending.appendChild(clone);
        });
    },

    finishedList: () => {
        state.dom.listFinished.innerHTML = '';

        const missingTechCount = state.data.terminados.filter(d => !d.preparationMethod || d.preparationMethod.trim() === '').length;
        state.dom.counterMissingTech.textContent = missingTechCount;

        if (state.data.terminados.length === 0) {
            state.dom.listFinished.textContent = '';
            const emptyLi = document.createElement('li');
            emptyLi.className = 'p-4 text-center text-slate-400 text-sm';
            emptyLi.textContent = 'El recetario está vacío.';
            state.dom.listFinished.appendChild(emptyLi);
            return;
        }

        state.data.terminados.forEach(dish => {
            const clone = state.dom.tplPending.content.cloneNode(true);
            const badgeCat = clone.querySelector('.col-categoria');
            badgeCat.className = 'bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded uppercase';
            badgeCat.textContent = dish.categoryName || 'Sin Categoría';

            // 🟢 UX: Evaluamos si le falta la ficha técnica o ya está completo
            const badgeEstado = clone.querySelector('.bg-amber-100');
            if (dish.preparationMethod && dish.preparationMethod.trim() !== '') {
                badgeEstado.className = 'bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded';
                badgeEstado.textContent = 'Completo';
            } else {
                badgeEstado.className = 'bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-200';
                badgeEstado.textContent = 'Falta Receta';
            }

            clone.querySelector('.col-nombre').textContent = dish.name;
            clone.querySelector('.col-codigo').textContent = dish.dishCode;

            const li = clone.querySelector('li');
            li.addEventListener('click', () => _actions.selectFinishedDish(dish, li));
            state.dom.listFinished.appendChild(clone);
        });
    },

    recipeTable: () => {
        state.dom.tableBody.innerHTML = '';
        state.data.recetaActual.forEach((item, index) => {
            const clone = state.dom.tplRow.content.cloneNode(true);
            clone.querySelector('.col-code').textContent = item.code;
            clone.querySelector('.col-name').textContent = item.name;
            clone.querySelector('.col-qty').textContent = `${item.qty} ${item.unit}`;
            clone.querySelector('button').setAttribute('data-index', index);
            state.dom.tableBody.appendChild(clone);
        });
        state.dom.btnFinish.disabled = state.data.recetaActual.length === 0;
    },

    toggleContext: (isActive) => {
        state.dom.ingCode.disabled = !isActive;
        state.dom.ingName.disabled = !isActive;
        state.dom.ingUnit.disabled = !isActive;
        state.dom.ingQty.disabled = !isActive;
        state.dom.btnAdd.disabled = !isActive;

        if (!isActive) {
            state.dom.activeDishName.textContent = 'Ningún platillo seleccionado';
            state.dom.form.reset();
            state.data.recetaActual = [];
            _render.recipeTable();
        }
    },

    techSheet: (dish, bomData) => {
        state.dom.techDishName.textContent = `${dish.name} (${dish.dishCode})`;
        state.dom.techPrepMethod.value = dish.preparationMethod || '';
        state.dom.btnSaveTech.disabled = false;

        // Render BOM de Solo Lectura (sin crear templates complejos)
        state.dom.techBomList.innerHTML = '';
        bomData.forEach(item => {
            const li = document.createElement('li');
            li.className = 'flex justify-between border-b border-slate-100 py-1.5';
            
            const spanName = document.createElement('span');
            spanName.textContent = `${item.code} - ${item.name}`;
            
            const spanQty = document.createElement('span');
            spanQty.className = 'font-bold text-slate-800';
            spanQty.textContent = `${item.qty} ${item.unit}`;
            
            li.appendChild(spanName);
            li.appendChild(spanQty);
            state.dom.techBomList.appendChild(li);
        });

        // Limpiar o Mostrar Foto
        state.data.currentImageBase64 = null;
        if (dish.imageUrl && dish.imageUrl.trim() !== '') {
            state.dom.techImgPreview.src = dish.imageUrl;
            state.dom.techImgPreview.classList.remove('hidden');
            state.dom.techImgPlaceholder.classList.add('hidden');
        } else {
            state.dom.techImgPreview.src = '';
            state.dom.techImgPreview.classList.add('hidden');
            state.dom.techImgPlaceholder.classList.remove('hidden');
        }
    }
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS (Privado)
// ==========================================================================
const API = {
    loadInitialData: async () => {
        try {
            const [resPendientes, resTerminados, resInsumos] = await Promise.all([
                fetchData(ENDPOINTS.kitchen.get.pendingDishes),
                fetchData(ENDPOINTS.kitchen.get.finishedDishes), // 🟢 Petición del recetario
                fetchData(ENDPOINTS.kitchen.get.ingredients)
            ]);
            state.data.pendientes = resPendientes.data || [];
            state.data.terminados = resTerminados.data || [];
            state.data.insumosCache = resInsumos.data || [];

            // 🟢 Inyectar Opciones al Datalist Híbrido
            if (state.dom.datalistCodes && state.dom.datalistNames) {
                state.dom.datalistCodes.innerHTML = '';
                state.dom.datalistNames.innerHTML = '';
                state.data.insumosCache.forEach(i => {
                    state.dom.datalistCodes.appendChild(new Option(i.name, i.code));
                    state.dom.datalistNames.appendChild(new Option(i.code, i.name));
                });
            }

            _render.pendingList();
            _render.finishedList();
        } catch (error) {
            console.error('[Recetas] Error cargando catálogos:', error);
            showErrorModal('No se pudo conectar con el servidor.', 'Error de Red');
        }
    },

    submitRecipe: async () => {
        try {
            state.dom.btnFinish.disabled = true;
            state.dom.btnFinish.textContent = '';
            const spinIcon = document.createElement('span');
            spinIcon.className = 'material-symbols-outlined animate-spin text-[20px] align-middle';
            spinIcon.textContent = 'sync';
            state.dom.btnFinish.appendChild(spinIcon);
            state.dom.btnFinish.appendChild(document.createTextNode(' Guardando...'));

            for (const item of state.data.recetaActual) {
                const existe = state.data.insumosCache.find(i => i.code === item.code);
                if (!existe) {
                    await postData(ENDPOINTS.kitchen.post.ingredient, { code: item.code, name: item.name, unit: item.unit });
                    state.data.insumosCache.push({ code: item.code, name: item.name, unit: item.unit });
                }
                await postData(ENDPOINTS.kitchen.post.recipeItem, { dishCode: state.data.activeDish.dishCode, ingredientCode: item.code, quantity: item.qty });
            }

            showSuccessModal('La receta matemática se ha procesado. Ahora puedes agregar la Ficha Técnica desde el Recetario Maestro.', 'Platillo Terminado');
            state.data.activeDish = null;
            _render.toggleContext(false);

            await API.loadInitialData(); // Refrescar para que pase a la otra pestaña

        } catch (error) {
            showErrorModal(error.message, 'Error al guardar Receta');
        } finally {
            state.dom.btnFinish.textContent = '';
            const checkIcon = document.createElement('span');
            checkIcon.className = 'material-symbols-outlined text-[20px] align-middle';
            checkIcon.textContent = 'check_circle';
            state.dom.btnFinish.appendChild(checkIcon);
            state.dom.btnFinish.appendChild(document.createTextNode(' Marcar Platillo como Terminado'));
            state.dom.btnFinish.disabled = false;
        }
    },

    saveTechSheet: async (e) => {
        e.preventDefault();
        if (!state.data.activeTechDish) return;

        try {
            state.dom.btnSaveTech.disabled = true;
            state.dom.btnSaveTech.textContent = 'Guardando...';

            // Usamos la imagen en Base64 cargada o la URL previa si no subió ninguna nueva
            const payload = {
                prepMethod: state.dom.techPrepMethod.value,
                imageUrl: state.data.currentImageBase64 || state.data.activeTechDish.imageUrl || ''
            };

            await putData(ENDPOINTS.kitchen.put.techSheet, payload, { dishCode: state.data.activeTechDish.dishCode });

            showSuccessModal('La ficha técnica de preparación ha sido guardada en el catálogo histórico.', 'Ficha Técnica Actualizada');
            await API.loadInitialData();

        } catch (error) {
            showErrorModal(error.message, 'Error al actualizar Ficha Técnica');
        } finally {
            state.dom.btnSaveTech.disabled = false;
            state.dom.btnSaveTech.textContent = 'Guardar Ficha';
        }
    }
};

const _actions = {
    _clearListSelection: (listNode, activeClass) => {
        const previos = listNode.querySelectorAll('.' + activeClass);
        previos.forEach(el => {
            el.classList.remove(activeClass, 'bg-amber-50', 'bg-emerald-50');
            el.classList.add('border-slate-200', 'bg-white'); // Vuelve al estado original
            el.style.borderColor = ''; // Limpia inline styles si hay
        });
    },

    selectPendingDish: (dish, elementNode) => {
        _actions._clearListSelection(state.dom.listPending, 'border-amber-500');
        elementNode.classList.remove('border-slate-200', 'bg-white');
        elementNode.classList.add('border-amber-500', 'bg-amber-50');

        state.data.activeDish = dish;
        state.dom.activeDishName.textContent = `${dish.name} (${dish.dishCode})`;
        _render.toggleContext(true);
        state.dom.ingCode.focus();
    },

    selectFinishedDish: async (dish, elementNode) => {
        _actions._clearListSelection(state.dom.listFinished, 'border-emerald-500');
        elementNode.classList.remove('border-slate-200', 'bg-white');
        elementNode.classList.add('border-emerald-500', 'bg-emerald-50');

        state.data.activeTechDish = dish;
        state.dom.techDishName.textContent = 'Cargando ingredientes...';

        try {
            // Traer el BOM del platillo desde PostgreSQL
            const res = await fetchData(ENDPOINTS.kitchen.get.recipeBOM, { dishCode: dish.dishCode });
            _render.techSheet(dish, res.data || []);
        } catch (error) {
            showErrorModal('No se pudieron cargar los ingredientes del platillo.', 'Error de Lectura');
            state.dom.techDishName.textContent = 'Error de conexión';
        }
    },

    addIngredientLocally: (e) => {
        e.preventDefault();
        const code = state.dom.ingCode.value.trim().toUpperCase();
        const name = state.dom.ingName.value.trim();
        const unit = state.dom.ingUnit.value;
        const qty = parseFloat(state.dom.ingQty.value);

        if (!RecetasRules.code.pattern.test(code)) return showErrorModal(RecetasRules.code.message, 'Código Inválido');
        if (!RecetasRules.qty.custom(qty)) return showErrorModal(RecetasRules.qty.message, 'Cantidad Inválida');

        const existeIndex = state.data.recetaActual.findIndex(i => i.code === code);
        if (existeIndex >= 0) state.data.recetaActual[existeIndex].qty = qty;
        else state.data.recetaActual.push({ code, name, unit, qty });

        _render.recipeTable();
        state.dom.form.reset();
        state.dom.ingName.disabled = false;
        state.dom.ingUnit.disabled = false;
        state.dom.ingCode.focus();
    }
};

// ==========================================================================
// 6. EVENTOS (Privado)
// ==========================================================================
const _bindEvents = () => {
    // Volver al KDS
    state.dom.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-nav');
            if (targetView) PubSub.publish('NAVIGATE', targetView);
        });
    });

    // Pestañas (Tabs)
    state.dom.tabPending.addEventListener('click', () => _render.switchTab('pending'));
    state.dom.tabFinished.addEventListener('click', () => _render.switchTab('finished'));

    // Flujo BOM (Pendientes)
    state.dom.form.addEventListener('submit', _actions.addIngredientLocally);
    state.dom.btnFinish.addEventListener('click', API.submitRecipe);

    // 🎯 Buscador Híbrido Bidireccional (Datalists Reactivos)
    state.dom.ingCode.addEventListener('input', (e) => {
        const inputCode = e.target.value.trim().toUpperCase();
        if (!inputCode) {
            state.dom.ingName.value = '';
            state.dom.ingUnit.value = '';
            state.dom.ingName.disabled = false;
            state.dom.ingUnit.disabled = false;
            return;
        }
        e.target.value = inputCode;
        const ingredienteEnCache = state.data.insumosCache.find(i => i.code === inputCode);
        if (ingredienteEnCache) {
            state.dom.ingName.value = ingredienteEnCache.name;
            state.dom.ingUnit.value = ingredienteEnCache.unit;
            state.dom.ingName.disabled = true;
            state.dom.ingUnit.disabled = true;
            state.dom.ingQty.focus(); // Ráfaga: Brincar directo a la cantidad
        }
    });

    state.dom.ingName.addEventListener('input', (e) => {
        const inputName = e.target.value.trim();
        if (!inputName) {
            state.dom.ingCode.value = '';
            state.dom.ingUnit.value = '';
            state.dom.ingCode.disabled = false;
            state.dom.ingUnit.disabled = false;
            return;
        }
        const ingredienteEnCache = state.data.insumosCache.find(i => i.name.toLowerCase() === inputName.toLowerCase());
        if (ingredienteEnCache) {
            state.dom.ingCode.value = ingredienteEnCache.code;
            state.dom.ingUnit.value = ingredienteEnCache.unit;
            state.dom.ingCode.disabled = true;
            state.dom.ingUnit.disabled = true;
            state.dom.ingQty.focus(); // Ráfaga: Brincar directo a la cantidad
        }
    });

    state.dom.tableBody.addEventListener('click', (e) => {
        const btnDelete = e.target.closest('button');
        if (btnDelete) {
            const index = btnDelete.getAttribute('data-index');
            state.data.recetaActual.splice(index, 1);
            _render.recipeTable();
        }
    });

    // Flujo Ficha Técnica (Terminados)
    state.dom.formTech.addEventListener('submit', API.saveTechSheet);

    // Convertir y COMPRIMIR imagen seleccionada a WebP usando la utilería
    state.dom.techImgUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Mostrar un pequeño feedback visual de que está procesando
            const originalNodes = Array.from(state.dom.techImgPlaceholder.childNodes);
            state.dom.techImgPlaceholder.textContent = '';
            
            const spinIcon = document.createElement('span');
            spinIcon.className = 'material-symbols-outlined animate-spin text-slate-400 text-4xl mb-2';
            spinIcon.textContent = 'sync';
            
            const msgP = document.createElement('p');
            msgP.className = 'text-sm text-slate-500 font-medium';
            msgP.textContent = 'Comprimiendo...';
            
            state.dom.techImgPlaceholder.appendChild(spinIcon);
            state.dom.techImgPlaceholder.appendChild(msgP);

            // 🟢 Llamamos a la utilería (800px de ancho máximo, 75% de calidad)
            const webpBase64 = await compressImageToWebP(file, 800, 0.75);

            // Guardamos en estado y actualizamos la vista
            state.data.currentImageBase64 = webpBase64;
            state.dom.techImgPreview.src = webpBase64;
            state.dom.techImgPreview.classList.remove('hidden');
            state.dom.techImgPlaceholder.classList.add('hidden');

            // Restauramos los nodos originales por si borran la foto
            state.dom.techImgPlaceholder.textContent = '';
            originalNodes.forEach(node => state.dom.techImgPlaceholder.appendChild(node));

        } catch (error) {
            showErrorModal(error.message, 'Error de Imagen');
        }
    });
};

// ==========================================================================
// 7. API PÚBLICA (Exportaciones)
// ==========================================================================
export const RecetasController = {
    mount: async (container) => {
        _cacheDOM(container);
        _render.toggleContext(false);
        state.dom.btnSaveTech.disabled = true; // Bloqueado hasta seleccionar platillo
        _bindEvents();
        await API.loadInitialData();
    }
};