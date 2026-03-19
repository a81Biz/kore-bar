// frontends/kitchen/js/views/recetas/index.js
import { PubSub } from '/shared/js/pubsub.js';
import { state } from './state.js';
import { _cacheDOM, _render, _actions } from './view.js';
import { _data, addIngredientLocally, handleImageUpload } from './logic.js';

// ── 7. EVENTOS ─────────────────────────────────────────────────
const _bindEvents = () => {
    state.dom.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-nav');
            if (targetView) PubSub.publish('NAVIGATE', targetView);
        });
    });

    state.dom.tabPending.addEventListener('click', () => _render.switchTab('pending'));
    state.dom.tabFinished.addEventListener('click', () => _render.switchTab('finished'));

    state.dom.form.addEventListener('submit', addIngredientLocally);
    state.dom.btnFinish.addEventListener('click', _data.submitRecipe);
    state.dom.formTech.addEventListener('submit', _data.saveTechSheet);
    state.dom.techImgUpload.addEventListener('change', handleImageUpload);

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
            state.dom.ingName.value = found.name;
            state.dom.ingUnit.value = found.unit;
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
            state.dom.ingCode.value = found.code;
            state.dom.ingUnit.value = found.unit;
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
};

// ── 8. API PÚBLICA ─────────────────────────────────────────────
export const RecetasController = {
    mount: async (container) => {
        _cacheDOM(container);
        _render.toggleContext(false);
        state.dom.btnSaveTech.disabled = true;
        _bindEvents();
        await _data.loadInitialData();
    }
};