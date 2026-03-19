// ============================================================
// menu/js/menu.js — Menú Digital de Kore Bar
// ============================================================
//
// ✅ Usa fetchData / postData de http.client.js (sin fetch() directo).
// ✅ Usa ENDPOINTS — sin URLs hardcodeadas.
// ✅ Datos de la API inyectados con textContent / setAttribute — sin XSS.
// ✅ Auto-arranca con DOMContentLoaded — no depende de kore.core.js.
//
// DECISIÓN ARQUITECTÓNICA:
//   Este micrositio es lectura pública (QR en mesa), no SPA con auth/views.
//   No usa PubSub, TemplateLoader ni viewManager del Core.
// ============================================================

import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

// ── Imagen de respaldo si el platillo no tiene foto ────────────────────────
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=300';

class MenuApp {
    constructor() {
        this.menuData = [];
        this.tableCode = this._getTableCodeFromUrl();
        this.isLoading = true;
        this.isModalOpen = false;
        this.toastTimeout = null;

        this.DOM = {
            tableIndicator: document.getElementById('tableIndicator'),
            categoryTabs: document.getElementById('categoryTabs'),
            menuContainer: document.getElementById('menuContainer'),
            callWaiterBtn: document.getElementById('callWaiterBtn'),
            callModal: document.getElementById('callModal'),
            callModalOverlay: document.getElementById('callModalOverlay'),
            callModalContent: document.getElementById('callModalContent'),
            closeModalBtn: document.getElementById('closeModalBtn'),
            reasonBtns: document.querySelectorAll('.call-reason-btn'),
            toast: document.getElementById('toast'),
            toastMsg: document.getElementById('toastMsg'),
            toastIcon: document.getElementById('toastIcon'),
            header: document.getElementById('mainHeader'),
            logoArea: document.getElementById('logoArea')
        };

        this._init();
    }

    // ── Tabla desde parámetro de URL (?table=XXX) ─────────────────────────
    _getTableCodeFromUrl() {
        return new URLSearchParams(window.location.search).get('table') || null;
    }

    async _init() {
        // Indicador de mesa — solo si viene en la URL; si no, se oculta
        if (this.tableCode) {
            this.DOM.tableIndicator.textContent = `Mesa ${this.tableCode}`;
        } else {
            this.DOM.tableIndicator.closest('div')?.classList.add('hidden');
        }

        this._logoArea();
        this._setupEventListeners();
        await this._fetchMenu();
        this._renderMenu();
        this._setupScrollSpy();
    }

    _logoArea() {
        this.DOM.logoArea.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // ── Fetch del menú ────────────────────────────────────────────────────
    async _fetchMenu() {
        try {
            const json = await fetchData(ENDPOINTS.menu.get.public);
            this.menuData = json.data || [];
        } catch (error) {
            console.error('[Menu] Error cargando menú:', error);
            this._showToast('Error de conexión al cargar el menú', 'error');
            this.menuData = [];
        } finally {
            this.isLoading = false;
        }
    }

    // ── Renderizado del menú ──────────────────────────────────────────────
    _renderMenu() {
        if (this.isLoading) return;
        this.DOM.menuContainer.innerHTML = '';
        this.DOM.categoryTabs.innerHTML = '';

        if (!this.menuData.length) {
            this._renderEmptyState();
            return;
        }

        this.menuData.forEach((cat, index) => {
            // Tab de categoría
            this.DOM.categoryTabs.appendChild(this._buildCategoryTab(cat, index === 0));
            // Sección de platillos
            this.DOM.menuContainer.appendChild(this._buildCategorySection(cat));
        });

        // Scroll suave al hacer clic en un tab
        this.DOM.categoryTabs.querySelectorAll('a').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = tab.getAttribute('href').substring(1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    this._setActiveTabVisuals(targetId);
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    _renderEmptyState() {
        const wrap = document.createElement('div');
        wrap.className = 'text-center p-12 text-slate-500 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-6xl mb-4 opacity-50 block mx-auto text-terracotta';
        icon.textContent = 'restaurant_menu';

        const h2 = document.createElement('h2');
        h2.className = 'text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight';
        h2.textContent = 'Menú no disponible';

        const p = document.createElement('p');
        p.className = 'font-medium';
        p.textContent = 'No hay platillos disponibles en este momento. Por favor contacta al mesero.';

        wrap.appendChild(icon);
        wrap.appendChild(h2);
        wrap.appendChild(p);
        this.DOM.menuContainer.appendChild(wrap);
    }

    // ── Tab de categoría ──────────────────────────────────────────────────
    _buildCategoryTab(cat, isFirst) {
        const a = document.createElement('a');
        // ✅ href construido con setAttribute — no innerHTML
        a.setAttribute('href', `#cat-${cat.categoryCode}`);
        a.dataset.target = `cat-${cat.categoryCode}`;
        a.className = [
            'category-tab shrink-0 flex items-center justify-center h-10 px-6 rounded-full font-bold text-sm',
            'transition-all duration-300 border shadow-sm snap-center',
            isFirst
                ? 'bg-white text-terracotta border-white'
                : 'bg-white/10 text-white border-white/20 hover:bg-white/30'
        ].join(' ');
        // ✅ nombre de categoría con textContent
        a.textContent = cat.categoryName;
        return a;
    }

    // ── Sección de categoría ──────────────────────────────────────────────
    _buildCategorySection(cat) {
        const section = document.createElement('section');
        section.id = `cat-${cat.categoryCode}`;
        section.className = 'category-section scroll-mt-32';

        // Título de la categoría
        const h2 = document.createElement('h2');
        h2.className = 'text-slate-900 dark:text-slate-100 text-2xl font-black px-1 mb-6 mt-4 flex items-center gap-3 tracking-tight';

        const accent = document.createElement('span');
        accent.className = 'w-2 h-8 bg-primary rounded-full drop-shadow-sm';

        // ✅ nombre con textContent — nunca innerHTML
        const catLabel = document.createTextNode(''); // placeholder
        h2.appendChild(accent);
        h2.appendChild(catLabel);
        catLabel.textContent = cat.categoryName; // ✅

        section.appendChild(h2);

        // Grid de platillos
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-5';

        if (cat.dishes.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'col-span-full p-6 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700';
            const emptyP = document.createElement('p');
            emptyP.className = 'font-medium text-sm';
            emptyP.textContent = 'No hay platillos habilitados en esta categoría actualmente.';
            empty.appendChild(emptyP);
            grid.appendChild(empty);
        } else {
            cat.dishes.forEach(dish => grid.appendChild(this._buildDishCard(dish)));
        }

        section.appendChild(grid);
        return section;
    }

    // ── Tarjeta de platillo ───────────────────────────────────────────────
    _buildDishCard(dish) {
        // ── Raíz ──
        const card = document.createElement('div');
        card.className = 'group flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3 shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700 active:scale-[0.98] transition-all cursor-pointer';

        // ── Imagen ──
        const imgWrap = document.createElement('div');
        imgWrap.className = 'w-full aspect-video bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden relative';

        const img = document.createElement('img');
        img.className = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-105';
        img.loading = 'lazy';
        // ✅ src y alt vía propiedad, no innerHTML — imageUrl viene de la API
        img.src = dish.imageUrl?.trim() || FALLBACK_IMG;
        img.alt = dish.name;                  // ✅ propiedad, no atributo interpolado

        // Overlay de precio
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-12';

        const priceSpan = document.createElement('span');
        priceSpan.className = 'text-white font-black text-xl tracking-tight drop-shadow-md';
        priceSpan.textContent = fmt(dish.price); // ✅ número formateado, no datos de API directos

        overlay.appendChild(priceSpan);
        imgWrap.appendChild(img);
        imgWrap.appendChild(overlay);

        // ── Info ──
        const info = document.createElement('div');
        info.className = 'flex flex-col gap-1.5 px-2 pb-1';

        const nameEl = document.createElement('h3');
        nameEl.className = 'text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight';
        nameEl.textContent = dish.name;          // ✅

        const descEl = document.createElement('p');
        descEl.className = 'text-slate-500 dark:text-slate-400 text-sm leading-snug line-clamp-2';
        descEl.textContent = dish.description || ''; // ✅

        info.appendChild(nameEl);
        info.appendChild(descEl);

        card.appendChild(imgWrap);
        card.appendChild(info);
        return card;
    }

    // ── ScrollSpy ─────────────────────────────────────────────────────────
    _setupScrollSpy() {
        const sections = document.querySelectorAll('.category-section');
        if (!sections.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this._setActiveTabVisuals(entry.target.getAttribute('id'));
                }
            });
        }, { root: null, rootMargin: '-130px 0px -60% 0px', threshold: 0 });

        sections.forEach(s => observer.observe(s));
    }

    _setActiveTabVisuals(activeId) {
        document.querySelectorAll('.category-tab').forEach(tab => {
            const isActive = tab.dataset.target === activeId;
            tab.classList.toggle('bg-white', isActive);
            tab.classList.toggle('text-terracotta', isActive);
            tab.classList.toggle('border-white', isActive);
            tab.classList.toggle('bg-white/10', !isActive);
            tab.classList.toggle('text-white', !isActive);
            tab.classList.toggle('border-white/20', !isActive);
            tab.classList.toggle('hover:bg-white/30', !isActive);
            if (isActive) tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    }

    // ── Modal ─────────────────────────────────────────────────────────────
    _setupEventListeners() {
        this.DOM.callWaiterBtn.addEventListener('click', () => this._openModal());
        this.DOM.closeModalBtn.addEventListener('click', () => this._closeModal());
        this.DOM.callModalOverlay.addEventListener('click', () => this._closeModal());

        this.DOM.reasonBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const reason = btn.dataset.reason;

                // ✅ Spinner con createElement — sin innerHTML
                const originalChildren = Array.from(btn.childNodes).map(n => n.cloneNode(true));
                btn.textContent = '';
                const spinIcon = document.createElement('span');
                spinIcon.className = 'material-symbols-outlined animate-spin mx-auto text-primary';
                spinIcon.textContent = 'progress_activity';
                btn.appendChild(spinIcon);

                this._handleCallWaiter(reason).finally(() => {
                    btn.textContent = '';
                    originalChildren.forEach(n => btn.appendChild(n));
                });
            });
        });

        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY > 10;
            this.DOM.header.classList.toggle('shadow-lg', scrolled);
            this.DOM.header.classList.toggle('shadow-md', !scrolled);
        });
    }

    _openModal() {
        if (this.isModalOpen) return;
        this.isModalOpen = true;
        this.DOM.callModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.DOM.callModalOverlay.classList.remove('opacity-0');
            this.DOM.callModalContent.classList.remove('opacity-0', 'translate-y-full', 'sm:scale-95');
            this.DOM.callModalContent.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
        });
        document.body.style.overflow = 'hidden';
    }

    _closeModal() {
        if (!this.isModalOpen) return;
        this.isModalOpen = false;
        this.DOM.callModalOverlay.classList.add('opacity-0');
        this.DOM.callModalContent.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
        this.DOM.callModalContent.classList.add('opacity-0', 'translate-y-full', 'sm:scale-95');
        document.body.style.overflow = '';
        setTimeout(() => { if (!this.isModalOpen) this.DOM.callModal.classList.add('hidden'); }, 300);
    }

    // ── Notificación al mesero ────────────────────────────────────────────
    async _handleCallWaiter(reason) {
        if (!this.tableCode) {
            this._showToast('No se detectó el número de mesa. Llama al mesero directamente.', 'error');
            this._closeModal();
            return;
        }

        try {
            await postData(
                ENDPOINTS.menu.post.callWaiter,
                { reason },
                { tableCode: this.tableCode }   // ✅ buildUrl reemplaza :tableCode
            );
            this._showToast('¡Mesero notificado! Enseguida te atenderemos.', 'success');
            this._closeModal();
        } catch (error) {
            console.error('[Menu] Error llamando al mesero:', error);
            this._showToast(error.message, 'error');
            this._closeModal();
        }
    }

    // ── Toast ─────────────────────────────────────────────────────────────
    _showToast(message, type = 'success') {
        const icons = { success: 'check_circle', error: 'error' };
        const colors = { success: 'text-emerald-400', error: 'text-red-400' };

        // ✅ mensaje inyectado con textContent
        this.DOM.toastMsg.textContent = message;
        this.DOM.toastIcon.textContent = icons[type];
        this.DOM.toastIcon.className = `material-symbols-outlined ${colors[type]} text-2xl`;

        this.DOM.toast.classList.remove('translate-y-20', 'opacity-0');

        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.DOM.toast.classList.add('translate-y-20', 'opacity-0');
        }, 4000);
    }
}

// ✅ Bootstrap limpio — sin depender de kore.core.js ni de window.launchMenuApp
document.addEventListener('DOMContentLoaded', () => {
    window.MenuDigitalApp = new MenuApp();
});