/**
 * Centralized User Interface Utilities for Kore Bar Frontends
 * Ensures native browser alerts are banned in favor of structured Tailwind modals.
 */

export const showErrorModal = (message, title = 'Error') => {
    // Check if an error modal already exists, remove it avoiding DOM pileups
    const existing = document.getElementById('ui-error-modal');
    if (existing) {
        existing.remove();
    }

    // Construct the overlay container
    const overlay = document.createElement('div');
    overlay.id = 'ui-error-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in';

    // Construct the actual modal card
    overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl border border-red-100 max-w-sm w-full overflow-hidden animate-slide-up">
            <div class="p-4 border-b border-red-100 bg-red-50 flex flex-col items-center justify-center text-center gap-2">
                <span class="material-symbols-outlined text-[40px] text-red-500">error</span>
                <h3 class="font-bold text-red-800 text-lg">${title}</h3>
            </div>
            <div class="p-6 text-center">
                <p class="text-slate-600 text-sm leading-relaxed">${message}</p>
            </div>
            <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                <button id="btn-close-error-modal" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors">
                    Entendido
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Bind Close Event mapped isolating leaks
    const btnClose = document.getElementById('btn-close-error-modal');
    btnClose.addEventListener('click', () => {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 200); // Wait for transition
    });
};

export const setFieldError = (inputId, hasError) => {
    const el = document.getElementById(inputId);
    if (!el) return;

    if (hasError) {
        el.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-1', 'focus:ring-red-500', 'bg-red-50');
        el.classList.remove('border-slate-200', 'focus:border-blue-500', 'focus:border-emerald-500', 'focus:border-purple-500', 'bg-white', 'bg-slate-50');

        // Find associated label ideally mapping standard layout structures if requested
        if (el.labels && el.labels.length > 0) {
            el.labels[0].classList.add('text-red-600');
        }
    } else {
        el.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-1', 'focus:ring-red-500', 'bg-red-50');
        el.classList.add('border-slate-200', 'bg-white'); // Reverts to base style

        if (el.labels && el.labels.length > 0) {
            el.labels[0].classList.remove('text-red-600');
        }
    }
};

export const showSuccessModal = (message, title = 'Éxito') => {
    // Check if a success modal already exists, remove it avoiding DOM pileups
    const existing = document.getElementById('ui-success-modal');
    if (existing) {
        existing.remove();
    }

    // Construct the overlay container
    const overlay = document.createElement('div');
    overlay.id = 'ui-success-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in';

    // Construct the actual modal card
    overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl border border-green-100 max-w-sm w-full overflow-hidden animate-slide-up">
            <div class="p-4 border-b border-green-100 bg-green-50 flex flex-col items-center justify-center text-center gap-2">
                <span class="material-symbols-outlined text-[40px] text-green-500">check_circle</span>
                <h3 class="font-bold text-green-800 text-lg">${title}</h3>
            </div>
            <div class="p-6 text-center">
                <p class="text-slate-600 text-sm leading-relaxed">${message}</p>
            </div>
            <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                <button id="btn-close-success-modal" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors">
                    Aceptar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Bind Close Event mapped isolating leaks
    const btnClose = document.getElementById('btn-close-success-modal');
    btnClose.addEventListener('click', () => {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 200); // Wait for transition
    });
};

// Agrega esto en frontends/shared/js/ui.js

export const confirmAction = (message) => {
    return new Promise((resolve) => {
        // Por ahora usamos el confirm nativo del navegador que es 100% seguro y síncrono.
        // Más adelante, si lo deseas, podemos cambiar esto por una modal hermosa de Tailwind 
        // sin tener que tocar la lógica de ningún controlador.
        const isConfirmed = window.confirm(message);
        resolve(isConfirmed);
    });
};