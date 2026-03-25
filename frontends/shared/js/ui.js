/**
 * Centralized User Interface Utilities for Kore Bar Frontends
 * Ensures native browser alerts are banned in favor of structured Tailwind modals.
 */

export const showErrorModal = (message, title = 'Error') => {
    const existing = document.getElementById('ui-error-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ui-error-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in';

    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-2xl border border-red-100 max-w-sm w-full overflow-hidden animate-slide-up';

    const header = document.createElement('div');
    header.className = 'p-4 border-b border-red-100 bg-red-50 flex flex-col items-center justify-center text-center gap-2';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[40px] text-red-500';
    icon.textContent = 'error';

    const titleEl = document.createElement('h3');
    titleEl.className = 'font-bold text-red-800 text-lg';
    titleEl.textContent = title;

    header.appendChild(icon);
    header.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'p-6 text-center';

    const msgEl = document.createElement('p');
    msgEl.className = 'text-slate-600 text-sm leading-relaxed';
    msgEl.textContent = message;

    body.appendChild(msgEl);

    const footer = document.createElement('div');
    footer.className = 'p-4 bg-slate-50 border-t border-slate-100 flex justify-center';

    const btnClose = document.createElement('button');
    btnClose.id = 'btn-close-error-modal';
    btnClose.className = 'w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors';
    btnClose.textContent = 'Entendido';

    footer.appendChild(btnClose);
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    btnClose.addEventListener('click', () => {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 200);
    });
};

export const setFieldError = (inputId, hasError) => {
    const el = document.getElementById(inputId);
    if (!el) return;

    if (hasError) {
        el.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-1', 'focus:ring-red-500', 'bg-red-50');
        el.classList.remove('border-slate-200', 'focus:border-blue-500', 'focus:border-emerald-500', 'focus:border-purple-500', 'bg-white', 'bg-slate-50');
        if (el.labels && el.labels.length > 0) el.labels[0].classList.add('text-red-600');
    } else {
        el.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-1', 'focus:ring-red-500', 'bg-red-50');
        el.classList.add('border-slate-200', 'bg-white');
        if (el.labels && el.labels.length > 0) el.labels[0].classList.remove('text-red-600');
    }
};

export const showSuccessModal = (message, title = 'Éxito') => {
    const existing = document.getElementById('ui-success-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ui-success-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in';

    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-2xl border border-green-100 max-w-sm w-full overflow-hidden animate-slide-up';

    const header = document.createElement('div');
    header.className = 'p-4 border-b border-green-100 bg-green-50 flex flex-col items-center justify-center text-center gap-2';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[40px] text-green-500';
    icon.textContent = 'check_circle';

    const titleEl = document.createElement('h3');
    titleEl.className = 'font-bold text-green-800 text-lg';
    titleEl.textContent = title;

    header.appendChild(icon);
    header.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'p-6 text-center';

    const msgEl = document.createElement('p');
    msgEl.className = 'text-slate-600 text-sm leading-relaxed';
    msgEl.textContent = message;

    body.appendChild(msgEl);

    const footer = document.createElement('div');
    footer.className = 'p-4 bg-slate-50 border-t border-slate-100 flex justify-center';

    const btnClose = document.createElement('button');
    btnClose.id = 'btn-close-success-modal';
    btnClose.className = 'w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors';
    btnClose.textContent = 'Aceptar';

    footer.appendChild(btnClose);
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    btnClose.addEventListener('click', () => {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 200);
    });
};

export const confirmAction = (message, title = '¿Confirmar acción?') => {
    return new Promise((resolve) => {
        const existing = document.getElementById('ui-confirm-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ui-confirm-modal';
        overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in';

        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden animate-slide-up';

        // Header
        const header = document.createElement('div');
        header.className = 'p-4 border-b border-slate-100 bg-slate-50 flex flex-col items-center justify-center text-center gap-2';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[40px] text-amber-500';
        icon.textContent = 'help';

        const titleEl = document.createElement('h3');
        titleEl.className = 'font-bold text-slate-800 text-lg';
        titleEl.textContent = title;

        header.appendChild(icon);
        header.appendChild(titleEl);

        // Body
        const body = document.createElement('div');
        body.className = 'p-6 text-center';

        const msgEl = document.createElement('p');
        msgEl.className = 'text-slate-600 text-sm leading-relaxed';
        msgEl.textContent = message;

        body.appendChild(msgEl);

        // Footer — dos botones
        const footer = document.createElement('div');
        footer.className = 'p-4 bg-slate-50 border-t border-slate-100 flex gap-3';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200';
        btnCancel.textContent = 'Cancelar';

        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'flex-1 px-4 py-2.5 text-sm font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors';
        btnConfirm.textContent = 'Confirmar';

        footer.appendChild(btnCancel);
        footer.appendChild(btnConfirm);

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(footer);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        btnConfirm.addEventListener('click', () => close(true));
        btnCancel.addEventListener('click', () => close(false));

        // Cerrar con Escape
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onKeydown);
                close(false);
            }
        };
        document.addEventListener('keydown', onKeydown);

        // Cerrar haciendo click fuera del card
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
};