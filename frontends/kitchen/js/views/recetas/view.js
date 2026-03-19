// frontends/kitchen/js/views/recetas/view.js
import { state } from './state.js';

// ── 3. CACHÉ DEL DOM ───────────────────────────────────────────
export const _cacheDOM = (container) => {
    state.dom.root = container;
    state.dom.navButtons = container.querySelectorAll('[data-nav]');

    state.dom.tabPending = container.querySelector('#tab-pending');
    state.dom.tabFinished = container.querySelector('#tab-finished');

    state.dom.listPending = container.querySelector('#list-pending-dishes');
    state.dom.listFinished = container.querySelector('#list-finished-dishes');
    state.dom.counterMissingBom = container.querySelector('#counter-missing-bom');
    state.dom.counterMissingTech = container.querySelector('#counter-missing-tech');
    state.dom.tplPending = document.querySelector('#tpl-item-pending');
    state.dom.tplBomRow = document.querySelector('#tpl-bom-row');

    state.dom.viewBomBuilder = container.querySelector('#view-bom-builder');
    state.dom.viewTechSheet = container.querySelector('#view-tech-sheet');

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

    state.dom.formTech = container.querySelector('#form-tech-sheet');
    state.dom.techDishName = container.querySelector('#tech-dish-name');
    state.dom.techImgUpload = container.querySelector('#tech-img-upload');
    state.dom.techImgPreview = container.querySelector('#tech-img-preview');
    state.dom.techImgPlaceholder = container.querySelector('#tech-img-placeholder');
    state.dom.techBomList = container.querySelector('#tech-bom-list');
    state.dom.techPrepMethod = container.querySelector('#tech-prep-method');
    state.dom.btnSaveTech = container.querySelector('#btn-save-tech');
};

// ── 4. RENDERIZADO ─────────────────────────────────────────────
export const _render = {
    switchTab: (tabName) => {
        const isPending = tabName === 'pending';

        state.dom.tabPending.className = isPending
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
            const badge = clone.querySelector('.bg-amber-100');
            badge.className = 'bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded';
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

            const badgeEstado = clone.querySelector('.bg-amber-100');
            const hasMethod = dish.preparationMethod && dish.preparationMethod.trim() !== '';
            badgeEstado.className = hasMethod
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
            clone.querySelector('.col-qty').textContent = `${item.qty} ${item.unit}`;
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

    techSheet: (dish, bomData) => {
        state.dom.techDishName.textContent = `${dish.name} (${dish.dishCode})`;
        state.dom.techPrepMethod.value = dish.preparationMethod || '';
        state.dom.btnSaveTech.disabled = false;

        state.dom.techBomList.innerHTML = '';
        bomData.forEach(item => {
            const rowClon = state.dom.tplBomRow.content.cloneNode(true);
            rowClon.querySelector('.col-bom-name').textContent = `${item.code} - ${item.name}`;
            rowClon.querySelector('.col-bom-qty').textContent = `${item.qty} ${item.unit}`;
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

// ── ACCIONES DE SELECCIÓN ──────────────────────────────────────
// Viven en view.js porque operan directamente sobre el DOM de la lista
// y necesitan llamar a _render. logic.js las importa para usarlas.
export const _actions = {
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

    // selectFinishedDish necesita fetchData — se sobreescribe desde logic.js
    // Esta versión solo hace la selección visual; logic.js añade la carga de BOM
    selectFinishedDish: null
};