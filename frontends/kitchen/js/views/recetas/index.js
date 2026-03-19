// ==========================================================================
// frontends/kitchen/js/views/recetas/index.js
// ==========================================================================

// ── 1. DEPENDENCIAS ────────────────────────────────────────────────────────
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { PubSub } from '/shared/js/pubsub.js';
import { RecetasRules } from './rules/recetas.rules.js';
import { showSuccessModal, showErrorModal } from '/shared/js/ui.js';
import { compressImageToWebP } from '/shared/js/utils.js';

// ── 2. ESTADO PRIVADO ──────────────────────────────────────────────────────
const state = {
    dom: {},
    data: {
        pendientes:          [],
        terminados:          [],
        insumosCache:        [],
        activeDish:          null,
        activeTechDish:      null,
        recetaActual:        [],
        currentImageBase64:  null
    }
};

// ── 3. CACHÉ DEL DOM ───────────────────────────────────────────────────────
const _cacheDOM = (container) => {
    state.dom.root       = container;
    state.dom.navButtons = container.querySelectorAll('[data-nav]');

    state.dom.tabPending  = container.querySelector('#tab-pending');
    state.dom.tabFinished = container.querySelector('#tab-finished');

    state.dom.listPending         = container.querySelector('#list-pending-dishes');
    state.dom.listFinished        = container.querySelector('#list-finished-dishes');
    state.dom.counterMissingBom   = container.querySelector('#counter-missing-bom');
    state.dom.counterMissingTech  = container.querySelector('#counter-missing-tech');
    state.dom.tplPending          = document.querySelector('#tpl-item-pending');
    state.dom.tplBomRow           = document.querySelector('#tpl-bom-row');

    state.dom.viewBomBuilder = container.querySelector('#view-bom-builder');
    state.dom.viewTechSheet  = container.querySelector('#view-tech-sheet');

    state.dom.activeDishName = container.querySelector('#active-dish-name');
    state.dom.form           = container.querySelector('#form-kitchen-ingredient');
    state.dom.ingCode        = container.querySelector('#ing-code');
    state.dom.ingName        = container.querySelector('#ing-name');
    state.dom.ingUnit        = container.querySelector('#ing-unit');
    state.dom.ingQty         = container.querySelector('#ing-qty');
    state.dom.datalistCodes  = container.querySelector('#datalist-codes');
    state.dom.datalistNames  = container.querySelector('#datalist-names');
    state.dom.btnAdd         = container.querySelector('#btn-add-ingredient');
    state.dom.tableBody      = container.querySelector('#table-recipe-body');
    state.dom.tplRow         = document.querySelector('#tpl-row-recipe');
    state.dom.btnFinish      = container.querySelector('#btn-finish-recipe');

    state.dom.formTech           = container.querySelector('#form-tech-sheet');
    state.dom.techDishName       = container.querySelector('#tech-dish-name');
    state.dom.techImgUpload      = container.querySelector('#tech-img-upload');
    state.dom.techImgPreview     = container.querySelector('#tech-img-preview');
    state.dom.techImgPlaceholder = container.querySelector('#tech-img-placeholder');
    state.dom.techBomList        = container.querySelector('#tech-bom-list');
    state.dom.techPrepMethod     = container.querySelector('#tech-prep-method');
    state.dom.btnSaveTech        = container.querySelector('#btn-save-tech');
};

// ── 4. RENDERIZADO ─────────────────────────────────────────────────────────
const _render = {
    switchTab: (tabName) => {
        const isPending = tabName === 'pending';

        state.dom.tabPending.className  = isPending
            ? 'flex-1 py-4 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 bg-white transition-colors'
            : 'flex-1 py-4 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors';
        state.dom.tabFinished.className = !isPending
            ? 'flex-1 py-4 text-sm font-bold border-b-2 border-emerald-600 text-emerald-600 bg-white transition-colors'
            : 'flex-1 py-4 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors';

        state.dom.listPending.classList.toggle('hidden', !isPending);
        state.dom.listFinished.classList.toggle('hidden', isPending);
        state.dom.viewBomBuilder.classList.toggle('hidden', !isPending);
        state.dom.viewTechSheet.classList.toggle('hidden', isPending);
    },

    pendingList: () => {
        state.dom.listPending.innerHTML = '';
        state.dom.counterMissingBom.textContent = state.data.pendientes.length;

        if (state.data.pendientes.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className   = 'p-4 text-center text-slate-400 text-sm';
            emptyLi.textContent = 'No hay platillos pendientes.';
            state.dom.listPending.appendChild(emptyLi);
            return;
        }

        state.data.pendientes.forEach(dish => {
            const clone = state.dom.tplPending.content.cloneNode(true);
            clone.querySelector('.col-categoria').textContent = dish.categoryName || 'Sin Categoría';
            clone.querySelector('.col-nombre').textContent    = dish.name;
            clone.querySelector('.col-codigo').textContent    = dish.dishCode;
            const badge = clone.querySelector('.bg-amber-100');
            badge.className   = 'bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded';
            badge.textContent = 'Faltan Insumos';
            const li = clone.querySelector('li');
            li.addEventListener('click', () => _actions.selectPendingDish(dish, li));
            state.dom.listPending.appendChild(clone);
        });
    },

    finishedList: () => {
        state.dom.listFinished.innerHTML = '';
        const missingTechCount = state.data.terminados.filter(
            d => !d.preparationMethod || d.preparationMethod.trim() === ''
        ).length;
        state.dom.counterMissingTech.textContent = missingTechCount;

        if (state.data.terminados.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className   = 'p-4 text-center text-slate-400 text-sm';
            emptyLi.textContent = 'El recetario está vacío.';
            state.dom.listFinished.appendChild(emptyLi);
            return;
        }

        state.data.terminados.forEach(dish => {
            const clone   = state.dom.tplPending.content.cloneNode(true);
            const badgeCat = clone.querySelector('.col-categoria');
            badgeCat.className   = 'bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded uppercase';
            badgeCat.textContent = dish.categoryName || 'Sin Categoría';

            const badgeEstado = clone.querySelector('.bg-amber-100');
            const hasMethod   = dish.preparationMethod && dish.preparationMethod.trim() !== '';
            badgeEstado.className   = hasMethod
                ? 'bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded'
                : 'bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-200';
            badgeEstado.textContent = hasMethod ? 'Completo' : 'Falta Receta';

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
            clone.querySelector('.col-qty').textContent  = `${item.qty} ${item.unit}`;
            clone.querySelector('button').setAttribute('data-index', index);
            state.dom.tableBody.appendChild(clone);
        });
        state.dom.btnFinish.disabled = state.data.recetaActual.length === 0;
    },

    toggleContext: (isActive) => {
        [state.dom.ingCode, state.dom.ingName, state.dom.ingUnit, state.dom.ingQty, state.dom.btnAdd]
            .forEach(el => { el.disabled = !isActive; });

        if (!isActive) {
            state.dom.activeDishName.textContent = 'Ningún platillo seleccionado';
            state.dom.form.reset();
            state.data.recetaActual = [];
            _render.recipeTable();
        }
    },

    // ✅ BOM de solo lectura usando tpl-bom-row — sin createElement suelto
    techSheet: (dish, bomData) => {
        state.dom.techDishName.textContent  = `${dish.name} (${dish.dishCode})`;
        state.dom.techPrepMethod.value      = dish.preparationMethod || '';
        state.dom.btnSaveTech.disabled      = false;

        state.dom.techBomList.innerHTML = '';
        bomData.forEach(item => {
            const rowClon = state.dom.tplBomRow.content.cloneNode(true);
            rowClon.querySelector('.col-bom-name').textContent = `${item.code} - ${item.name}`;
            rowClon.querySelector('.col-bom-qty').textContent  = `${item.qty} ${item.unit}`;
            state.dom.techBomList.appendChild(rowClon);
        });

        state.data.currentImageBase64 = null;
        if (dish.imageUrl?.trim()) {
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

// ── 5. LÓGICA DE DATOS ─────────────────────────────────────────────────────
// ✅ Renombrado de API → _data para evitar colisión semántica con el proyecto
const _data = {
    loadInitialData: async () => {
        try {
            const [resPendientes, resTerminados, resInsumos] = await Promise.all([
                fetchData(ENDPOINTS.kitchen.get.pendingDishes),
                fetchData(ENDPOINTS.kitchen.get.finishedDishes),
                fetchData(ENDPOINTS.kitchen.get.ingredients)
            ]);
            state.data.pendientes   = resPendientes.data || [];
            state.data.terminados   = resTerminados.data || [];
            state.data.insumosCache = resInsumos.data    || [];

            // Inyectar datalists
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

            // ✅ Spinner limpio con createElement — sin mezclar innerHTML y createTextNode
            state.dom.btnFinish.textContent = '';
            const spinIcon = document.createElement('span');
            spinIcon.className   = 'material-symbols-outlined animate-spin text-[20px] align-middle mr-2';
            spinIcon.textContent = 'sync';
            const spinLabel = document.createTextNode('Guardando...');
            state.dom.btnFinish.appendChild(spinIcon);
            state.dom.btnFinish.appendChild(spinLabel);

            for (const item of state.data.recetaActual) {
                const existe = state.data.insumosCache.find(i => i.code === item.code);
                if (!existe) {
                    await postData(ENDPOINTS.kitchen.post.ingredient, {
                        code: item.code, name: item.name, unit: item.unit
                    });
                    state.data.insumosCache.push({ code: item.code, name: item.name, unit: item.unit });
                }
                await postData(ENDPOINTS.kitchen.post.recipeItem, {
                    dishCode: state.data.activeDish.dishCode,
                    ingredientCode: item.code,
                    quantity: item.qty
                });
            }

            showSuccessModal(
                'La receta matemática se ha procesado. Ahora puedes agregar la Ficha Técnica desde el Recetario Maestro.',
                'Platillo Terminado'
            );
            state.data.activeDish = null;
            _render.toggleContext(false);
            await _data.loadInitialData();

        } catch (error) {
            showErrorModal(error.message, 'Error al guardar Receta');
        } finally {
            // ✅ Restaurar botón limpiamente
            state.dom.btnFinish.textContent = '';
            const checkIcon = document.createElement('span');
            checkIcon.className   = 'material-symbols-outlined text-[20px] align-middle mr-2';
            checkIcon.textContent = 'check_circle';
            state.dom.btnFinish.appendChild(checkIcon);
            state.dom.btnFinish.appendChild(document.createTextNode('Marcar Platillo como Terminado'));
            state.dom.btnFinish.disabled = false;
        }
    },

    saveTechSheet: async (e) => {
        e.preventDefault();
        if (!state.data.activeTechDish) return;

        try {
            state.dom.btnSaveTech.disabled     = true;
            state.dom.btnSaveTech.textContent  = 'Guardando...';

            const payload = {
                prepMethod: state.dom.techPrepMethod.value,
                imageUrl:   state.data.currentImageBase64 || state.data.activeTechDish.imageUrl || ''
            };

            await putData(
                ENDPOINTS.kitchen.put.techSheet,
                payload,
                { dishCode: state.data.activeTechDish.dishCode }
            );

            showSuccessModal(
                'La ficha técnica de preparación ha sido guardada en el catálogo histórico.',
                'Ficha Técnica Actualizada'
            );
            await _data.loadInitialData();

        } catch (error) {
            showErrorModal(error.message, 'Error al actualizar Ficha Técnica');
        } finally {
            state.dom.btnSaveTech.disabled    = false;
            state.dom.btnSaveTech.textContent = 'Guardar Ficha';
        }
    }
};

// ── 6. ACCIONES DE SELECCIÓN ───────────────────────────────────────────────
const _actions = {
    _clearListSelection: (listNode, activeClass) => {
        listNode.querySelectorAll('.' + activeClass).forEach(el => {
            el.classList.remove(activeClass, 'bg-amber-50', 'bg-emerald-50');
            el.classList.add('border-slate-200', 'bg-white');
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
        const qty  = parseFloat(state.dom.ingQty.value);

        if (!RecetasRules.code.pattern.test(code))  return showErrorModal(RecetasRules.code.message, 'Código Inválido');
        if (!RecetasRules.qty.custom(qty))           return showErrorModal(RecetasRules.qty.message, 'Cantidad Inválida');

        const existeIndex = state.data.recetaActual.findIndex(i => i.code === code);
        if (existeIndex >= 0) state.data.recetaActual[existeIndex].qty = qty;
        else                  state.data.recetaActual.push({ code, name, unit, qty });

        _render.recipeTable();
        state.dom.form.reset();
        state.dom.ingName.disabled = false;
        state.dom.ingUnit.disabled = false;
        state.dom.ingCode.focus();
    }
};

// ── 7. EVENTOS ─────────────────────────────────────────────────────────────
const _bindEvents = () => {
    state.dom.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-nav');
            if (targetView) PubSub.publish('NAVIGATE', targetView);
        });
    });

    state.dom.tabPending.addEventListener('click',  () => _render.switchTab('pending'));
    state.dom.tabFinished.addEventListener('click', () => _render.switchTab('finished'));

    state.dom.form.addEventListener('submit', _actions.addIngredientLocally);
    state.dom.btnFinish.addEventListener('click', _data.submitRecipe);

    // Buscador híbrido bidireccional
    state.dom.ingCode.addEventListener('input', (e) => {
        const inputCode = e.target.value.trim().toUpperCase();
        e.target.value = inputCode;
        if (!inputCode) {
            state.dom.ingName.value = '';
            state.dom.ingUnit.value = '';
            state.dom.ingName.disabled = false;
            state.dom.ingUnit.disabled = false;
            return;
        }
        const found = state.data.insumosCache.find(i => i.code === inputCode);
        if (found) {
            state.dom.ingName.value    = found.name;
            state.dom.ingUnit.value    = found.unit;
            state.dom.ingName.disabled = true;
            state.dom.ingUnit.disabled = true;
            state.dom.ingQty.focus();
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
        const found = state.data.insumosCache.find(
            i => i.name.toLowerCase() === inputName.toLowerCase()
        );
        if (found) {
            state.dom.ingCode.value    = found.code;
            state.dom.ingUnit.value    = found.unit;
            state.dom.ingCode.disabled = true;
            state.dom.ingUnit.disabled = true;
            state.dom.ingQty.focus();
        }
    });

    state.dom.tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
            state.data.recetaActual.splice(btn.getAttribute('data-index'), 1);
            _render.recipeTable();
        }
    });

    state.dom.formTech.addEventListener('submit', _data.saveTechSheet);

    // Comprimir imagen a WebP antes de almacenar en state
    state.dom.techImgUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Feedback visual de compresión
            const originalNodes = Array.from(state.dom.techImgPlaceholder.childNodes);
            state.dom.techImgPlaceholder.textContent = '';
            const spinIcon = document.createElement('span');
            spinIcon.className   = 'material-symbols-outlined animate-spin text-slate-400 text-4xl mb-2';
            spinIcon.textContent = 'sync';
            const msgP = document.createElement('p');
            msgP.className   = 'text-sm text-slate-500 font-medium';
            msgP.textContent = 'Comprimiendo...';
            state.dom.techImgPlaceholder.appendChild(spinIcon);
            state.dom.techImgPlaceholder.appendChild(msgP);

            const webpBase64 = await compressImageToWebP(file, 800, 0.75);
            state.data.currentImageBase64 = webpBase64;
            state.dom.techImgPreview.src = webpBase64;
            state.dom.techImgPreview.classList.remove('hidden');
            state.dom.techImgPlaceholder.classList.add('hidden');

            // Restaurar placeholder por si borran la foto
            state.dom.techImgPlaceholder.textContent = '';
            originalNodes.forEach(node => state.dom.techImgPlaceholder.appendChild(node));

        } catch (error) {
            showErrorModal(error.message, 'Error de Imagen');
        }
    });
};

// ── 8. API PÚBLICA ─────────────────────────────────────────────────────────
export const RecetasController = {
    mount: async (container) => {
        _cacheDOM(container);
        _render.toggleContext(false);
        state.dom.btnSaveTech.disabled = true;
        _bindEvents();
        await _data.loadInitialData();
    }
};
