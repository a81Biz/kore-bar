// frontends/kitchen/js/views/recetas/logic.js
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { compressImageToWebP } from '/shared/js/utils.js';
import { showSuccessModal, showErrorModal } from '/shared/js/ui.js';
import { RecetasRules } from './rules/recetas.rules.js';
import { state } from './state.js';
import { _render, _actions } from './view.js';

// ── 5. LÓGICA DE DATOS ─────────────────────────────────────────
export const _data = {
    loadInitialData: async () => {
        try {
            const [resPendientes, resTerminados, resInsumos] = await Promise.all([
                fetchData(ENDPOINTS.kitchen.get.pendingDishes),
                fetchData(ENDPOINTS.kitchen.get.finishedDishes),
                fetchData(ENDPOINTS.kitchen.get.ingredients)
            ]);
            state.data.pendientes = resPendientes.data.dishes || [];
            state.data.terminados = resTerminados.data.dishes || [];
            state.data.insumosCache = resInsumos.data.ingredients || [];

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
            spinIcon.className = 'material-symbols-outlined animate-spin text-[20px] align-middle mr-2';
            spinIcon.textContent = 'sync';
            state.dom.btnFinish.appendChild(spinIcon);
            state.dom.btnFinish.appendChild(document.createTextNode('Guardando...'));

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
            state.dom.btnFinish.textContent = '';
            const checkIcon = document.createElement('span');
            checkIcon.className = 'material-symbols-outlined text-[20px] align-middle mr-2';
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
            state.dom.btnSaveTech.disabled = true;
            state.dom.btnSaveTech.textContent = 'Guardando...';

            const payload = {
                preparationMethod: state.dom.techPrepMethod.value,
                imageUrl: state.data.currentImageBase64 || state.data.activeTechDish.imageUrl || ''
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
            state.dom.btnSaveTech.disabled = false;
            state.dom.btnSaveTech.textContent = 'Guardar Ficha';
        }
    }
};

// ── ACCIÓN QUE NECESITA FETCH: selectFinishedDish ─────────────
// Se inyecta sobre _actions porque require fetchData (depende de este módulo,
// no de view.js). Dependencia unidireccional: logic → view → state.
_actions.selectFinishedDish = async (dish, elementNode) => {
    _actions._clearListSelection(state.dom.listFinished, 'border-emerald-500');
    elementNode.classList.remove('border-slate-200', 'bg-white');
    elementNode.classList.add('border-emerald-500', 'bg-emerald-50');

    state.data.activeTechDish = dish;
    state.dom.techDishName.textContent = 'Cargando ingredientes...';

    try {
        const res = await fetchData(ENDPOINTS.kitchen.get.recipeBOM, { dishCode: dish.dishCode });
        _render.techSheet(dish, res.data?.bom || []);
    } catch (error) {
        showErrorModal('No se pudieron cargar los ingredientes del platillo.', 'Error de Lectura');
        state.dom.techDishName.textContent = 'Error de conexión';
    }
};

// ── ACCIÓN LOCAL: addIngredientLocally ────────────────────────
export const addIngredientLocally = (e) => {
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
};

// ── COMPRESIÓN DE IMAGEN ──────────────────────────────────────
export const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
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

        const webpBase64 = await compressImageToWebP(file, 800, 0.75);
        state.data.currentImageBase64 = webpBase64;
        state.dom.techImgPreview.src = webpBase64;
        state.dom.techImgPreview.classList.remove('hidden');
        state.dom.techImgPlaceholder.classList.add('hidden');

        state.dom.techImgPlaceholder.textContent = '';
        originalNodes.forEach(node => state.dom.techImgPlaceholder.appendChild(node));
    } catch (error) {
        showErrorModal(error.message, 'Error de Imagen');
    }
};