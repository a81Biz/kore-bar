import { KORE_CONFIG } from '/core/js/kore.config.js';

class MenuApp {
    constructor() {
        this.menuData = [];
        this.tableCode = this.getTableCodeFromUrl() || 'T-01'; // Default Fallback, assuming T-01 exists for real life mock or QR
        this.isLoading = true;
        this.isModalOpen = false;
        
        // Caching DOM elements
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
            header: document.getElementById('mainHeader')
        };

        this.init();
    }

    getTableCodeFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('table');
    }

    async init() {
        this.DOM.tableIndicator.textContent = `Mesa ${this.tableCode}`;
        this.setupEventListeners();
        
        await this.fetchMenu();
        this.renderMenu();
        this.setupScrollSpy();
    }

    setupEventListeners() {
        // Modal logic
        this.DOM.callWaiterBtn.addEventListener('click', () => this.openModal());
        this.DOM.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.DOM.callModalOverlay.addEventListener('click', () => this.closeModal());

        // Waiter Call Reason buttons
        this.DOM.reasonBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const reason = btn.dataset.reason;
                // Add loading state to button
                const originalContent = btn.innerHTML;
                btn.innerHTML = `<span class="material-symbols-outlined animate-spin mx-auto text-primary">progress_activity</span>`;
                
                this.handleCallWaiter(reason).finally(() => {
                    btn.innerHTML = originalContent;
                });
            });
        });

        // Sticky Header Shadow transition
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                this.DOM.header.classList.add('shadow-lg');
                this.DOM.header.classList.remove('shadow-md');
            } else {
                this.DOM.header.classList.add('shadow-md');
                this.DOM.header.classList.remove('shadow-lg');
            }
        });
    }

    async fetchMenu() {
        try {
            const response = await fetch(`${KORE_CONFIG.API.BASE_URL}/menu/public`);
            if (!response.ok) throw new Error('API Error');
            const json = await response.json();
            this.menuData = json.data || json; // Handle standard API response wrappers
        } catch (error) {
            console.error('Error fetching menu:', error);
            this.showToast('Error de conexión al cargar el menú', 'error');
            this.menuData = [];
        } finally {
            this.isLoading = false;
        }
    }

    renderMenu() {
        if (this.isLoading) return;

        if (!this.menuData || this.menuData.length === 0) {
            this.DOM.menuContainer.innerHTML = `
                <div class="text-center p-12 text-slate-500 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <span class="material-symbols-outlined text-6xl mb-4 opacity-50 block mx-auto text-terracotta">restaurant_menu</span>
                    <h2 class="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Menú no disponible</h2>
                    <p class="font-medium">No hay platillos disponibles en este momento. Por favor contacta al mesero.</p>
                </div>
            `;
            this.DOM.categoryTabs.innerHTML = '';
            return;
        }

        // Render Top Tabs (Scrollspy Targets)
        this.DOM.categoryTabs.innerHTML = this.menuData.map((cat, index) => `
            <a href="#cat-${cat.categoryCode}" class="category-tab shrink-0 flex items-center justify-center h-10 px-6 rounded-full font-bold text-sm transition-all duration-300 border shadow-sm snap-center ${index === 0 ? 'bg-white text-terracotta border-white' : 'bg-white/10 text-white border-white/20 hover:bg-white/30'}" data-target="cat-${cat.categoryCode}">
                ${cat.categoryName}
            </a>
        `).join('');

        // Render Main Categories & Dishes
        this.DOM.menuContainer.innerHTML = this.menuData.map(cat => `
            <section id="cat-${cat.categoryCode}" class="category-section scroll-mt-32">
                <h2 class="text-slate-900 dark:text-slate-100 text-2xl font-black px-1 mb-6 mt-4 flex items-center gap-3 tracking-tight">
                    <span class="w-2 h-8 bg-primary rounded-full drop-shadow-sm"></span>
                    ${cat.categoryName}
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    ${cat.dishes.length > 0 
                        ? cat.dishes.map(dish => this.renderDishCard(dish)).join('') 
                        : '<div class="col-span-full p-6 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700"><p class="font-medium text-sm">No hay platillos habilitados en esta categoría actualmente.</p></div>'}
                </div>
            </section>
        `).join('');

        // Setup smooth scroll click handler for tabs
        this.DOM.categoryTabs.querySelectorAll('a').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = tab.getAttribute('href').substring(1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    // Update tab state immediately for better response feel
                    this.setActiveTabVisuals(targetId);
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    renderDishCard(dish) {
        const formatPrice = (price) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
        // Clean up visual presentation for missing images
        const imageUrl = dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=300';
        
        return `
            <div class="group flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3 shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700 active:scale-[0.98] transition-all cursor-pointer">
                <div class="w-full aspect-video bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden relative">
                    <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="${imageUrl}" alt="${dish.name}" loading="lazy" />
                    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-12">
                        <span class="text-white font-black text-xl tracking-tight drop-shadow-md">${formatPrice(dish.price)}</span>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 px-2 pb-1">
                    <h3 class="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight">${dish.name}</h3>
                    <p class="text-slate-500 dark:text-slate-400 text-sm leading-snug line-clamp-2">${dish.description || ''}</p>
                </div>
            </div>
        `;
    }

    setupScrollSpy() {
        const sections = document.querySelectorAll('.category-section');
        if (sections.length === 0) return;

        const observerOptions = {
            root: null,
            rootMargin: '-130px 0px -60% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    this.setActiveTabVisuals(id);
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    setActiveTabVisuals(activeId) {
        const tabs = document.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            if (tab.dataset.target === activeId) {
                tab.classList.remove('bg-white/10', 'text-white', 'border-white/20', 'hover:bg-white/30');
                tab.classList.add('bg-white', 'text-terracotta', 'border-white');
                // Auto scroll tab container horizontally into view
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                tab.classList.add('bg-white/10', 'text-white', 'border-white/20', 'hover:bg-white/30');
                tab.classList.remove('bg-white', 'text-terracotta', 'border-white');
            }
        });
    }

    openModal() {
        if (this.isModalOpen) return;
        this.isModalOpen = true;
        this.DOM.callModal.classList.remove('hidden');
        
        // Mobile bottom sheet vs Desktop modal centering animation
        requestAnimationFrame(() => {
            this.DOM.callModalOverlay.classList.remove('opacity-0');
            this.DOM.callModalContent.classList.remove('opacity-0', 'translate-y-full', 'sm:scale-95');
            this.DOM.callModalContent.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
        });
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        if (!this.isModalOpen) return;
        this.isModalOpen = false;
        
        this.DOM.callModalOverlay.classList.add('opacity-0');
        this.DOM.callModalContent.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
        this.DOM.callModalContent.classList.add('opacity-0', 'translate-y-full', 'sm:scale-95');
        
        document.body.style.overflow = '';
        
        setTimeout(() => {
            if (!this.isModalOpen) {
                this.DOM.callModal.classList.add('hidden');
            }
        }, 300); // 300ms matches Tailwind transition-all duration
    }

    async handleCallWaiter(reason) {
        try {
            const tableToCall = this.tableCode === 'T-01' ? 'TEST-TBL-1' : this.tableCode; 
            
            const response = await fetch(`${KORE_CONFIG.API.BASE_URL}/tables/${tableToCall}/call-waiter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            
            if (response.ok) {
                this.showToast('¡Mesero notificado! Enseguida te atenderemos.', 'success');
                this.closeModal();
            } else {
                const json = await response.json();
                throw new Error(json.error || 'Mesa no configurada o error en servidor');
            }
        } catch (error) {
            console.error('Call waiter error:', error);
            this.showToast(error.message, 'error');
            this.closeModal();
        }
    }

    showToast(message, type = 'success') {
        const icons = {
            success: 'check_circle',
            error: 'error'
        };
        const textColors = {
            success: 'text-emerald-400',
            error: 'text-red-400'
        };

        this.DOM.toastMsg.textContent = message;
        this.DOM.toastIcon.textContent = icons[type];
        this.DOM.toastIcon.className = `material-symbols-outlined ${textColors[type]} text-2xl`;

        // Animate In
        this.DOM.toast.classList.remove('translate-y-20', 'opacity-0');
        
        // Hide after 4s
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.DOM.toast.classList.add('translate-y-20', 'opacity-0');
        }, 4000);
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    window.MenuDigitalApp = new MenuApp();
});
