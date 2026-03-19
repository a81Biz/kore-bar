// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { PubSub } from '/shared/js/pubsub.js';

// ==========================================================================
// 2. ESTADO PRIVADO
// ==========================================================================
const _dom = {
    container: null,
    navButtons: []
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const _cacheDOM = (container) => {
    _dom.container = container;
    _dom.navButtons = container.querySelectorAll('button[data-nav]');
};

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO
// ==========================================================================
const _render = {
    setActiveState: (viewName) => {
        // Limpiar estado activo de todos los botones
        _dom.navButtons.forEach(b => {
            b.classList.remove('bg-blue-50', 'text-blue-700');
            b.classList.add('text-slate-600');
        });

        // Activar solo el botón correspondiente a la vista actual
        const activeBtn = _dom.container.querySelector(`button[data-nav="${viewName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('bg-blue-50', 'text-blue-700');
            activeBtn.classList.remove('text-slate-600');
        }
    }
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO
// ==========================================================================
const _logic = {
    // El sidebar tiene lógica de negocio mínima, solo despacha eventos.
};

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
const _bindEvents = () => {
    // Delegación de eventos para los clics en el menú (más eficiente en memoria)
    _dom.container.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-nav]');
        if (!btn) return;

        const targetView = btn.getAttribute('data-nav');
        if (targetView) {
            PubSub.publish('NAVIGATE', targetView);
        }
    });

    // Suscribirse al PubSub por si algo más cambia la ruta (ej. código de arranque en app.js)
    PubSub.subscribe('NAVIGATE', (viewName) => {
        _render.setActiveState(viewName);
    });
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const mount = (container) => {
    console.log('[SidebarController] Montando vista...');
    _cacheDOM(container);
    _bindEvents();
};