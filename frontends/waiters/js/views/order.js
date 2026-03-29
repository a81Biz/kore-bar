// waiters/js/views/order.js
import { PubSub } from '/shared/js/pubsub.js';
import { formatCurrency } from '/shared/js/utils.js';
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';
import { showErrorModal, confirmAction } from '/shared/js/ui.js';

export async function mount(container, data = {}) {
    // ── Estado ────────────────────────────────────────────────────────────
    let cart = [];
    let sentItems = [];
    let activeCategory = null;
    let MENU_ITEMS = [];
    let CATEGORIES = [];

    const { tableCode, status, waiterName, authData } = data;
    const employeeNumber = authData?.employeeNumber;

    // ── DOM ───────────────────────────────────────────────────────────────
    const btnHome = container.querySelector('#btn-home');
    const btnCloseOrder = container.querySelector('#btn-close-order');
    const btnShowQr = container.querySelector('#btn-show-qr');
    const categoryTabs = container.querySelector('#category-tabs');
    const menuGrid = container.querySelector('#menu-grid');
    const cartTableLabel = container.querySelector('.col-cart-table');
    const cartTime = container.querySelector('#cart-time');
    const cartItemsContainer = container.querySelector('#cart-items-container');
    const cartSubtotal = container.querySelector('#cart-subtotal');
    const cartTax = container.querySelector('#cart-tax');
    const cartTotal = container.querySelector('#cart-total');
    const btnSendKitchen = container.querySelector('#btn-send-kitchen');
    const btnPayClose = container.querySelector('#btn-pay-close');
    const notificationBanner = container.querySelector('#notification-banner');
    const orderWaiterLabel = container.querySelector('.col-order-waiter');

    if (cartTableLabel) cartTableLabel.textContent = tableCode ? `Mesa ${tableCode}` : 'Nueva Orden';
    if (cartTime) cartTime.textContent = new Date().toLocaleTimeString('es-MX', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    if (orderWaiterLabel && authData?.name) orderWaiterLabel.textContent = authData.name;

    // ── Abrir sesión de mesa ──────────────────────────────────────────────
    const ensureTableSession = async () => {
        if (!tableCode) return;
        if (status === 'OCCUPIED') { await syncOrderStatus(); return; }
        try {
            await postData(ENDPOINTS.waiters.post.openTable, { employeeNumber, diners: 2 }, { tableCode });
        } catch (e) {
            console.warn('[Order] Error abriendo sesión de mesa:', e);
        }
    };
    ensureTableSession();

    // ── Carga de datos ────────────────────────────────────────────────────
    // FIX #15: Reemplazar ENDPOINTS.admin.get.menuCategories + ENDPOINTS.admin.get.menuDishes
    // por ENDPOINTS.menu.get.public — el micrositio de meseros no debe depender del dominio Admin.
    // ENDPOINTS.waiters.get.floorStock apunta al nuevo endpoint propio de meseros (/waiters/floor-stock)
    // que no expone el dominio de inventario admin.
    const loadMenuData = async () => {
        try {
            const stockRes = await fetchData(ENDPOINTS.waiters.get.floorStock);
            if (stockRes.success) {
                const stockArray = stockRes.data?.stock || stockRes.data || [];

                const catMap = new Map();
                MENU_ITEMS = stockArray.map(d => {
                    if (!catMap.has(d.categoryCode)) {
                        catMap.set(d.categoryCode, {
                            id: d.categoryName,
                            code: d.categoryCode,
                            icon: 'restaurant_menu'
                        });
                    }
                    return {
                        id: d.dishCode,
                        dishCode: d.dishCode,
                        name: d.name,
                        price: parseFloat(d.price),
                        category: d.categoryName,
                        location: d.routeToKds ? 'Cocina' : 'Barra',
                        stock: parseFloat(d.stock_available ?? 99),
                        img: d.imageUrl || ''
                    };
                });

                CATEGORIES = Array.from(catMap.values());
                activeCategory = CATEGORIES[0]?.id || null;
            }

            renderCategories();
            renderMenu();
        } catch (e) {
            console.error('[Order] Error cargando datos del menú:', e);
        }
    };

    // ── Categorías ────────────────────────────────────────────────────────
    const renderCategories = () => {
        categoryTabs.innerHTML = '';
        const tpl = document.getElementById('tpl-order-category-tab');

        CATEGORIES.forEach(cat => {
            const clone = tpl.content.cloneNode(true);
            const btn = clone.querySelector('button');
            const iconEl = clone.querySelector('.col-icon');
            const nameEl = clone.querySelector('.col-name');

            const isActive = activeCategory === cat.id;

            if (isActive) {
                btn.className = 'px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all shrink-0 bg-primary text-white shadow-primary/20';
            } else {
                btn.className = 'px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all shrink-0 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50';
            }

            iconEl.textContent = cat.icon;
            nameEl.textContent = cat.id;

            btn.addEventListener('click', () => {
                activeCategory = cat.id;
                renderCategories();
                renderMenu();
            });
            categoryTabs.appendChild(clone);
        });
    };

    // ── Grid de platillos ─────────────────────────────────────────────────
    const renderMenu = () => {
        menuGrid.innerHTML = '';
        const tpl = document.getElementById('tpl-order-menu-item');

        MENU_ITEMS.filter(i => i.category === activeCategory).forEach(item => {
            const clone = tpl.content.cloneNode(true);
            const el = clone.querySelector('.group');
            const imgDiv = clone.querySelector('.col-img');
            const badgeBg = clone.querySelector('.col-badge-bg');
            const badgeIcon = clone.querySelector('.col-badge-icon');
            const nameEl = clone.querySelector('.col-name');
            const priceSpan = clone.querySelector('.col-price');
            const stockSpan = clone.querySelector('.col-stock');

            imgDiv.style.backgroundImage = `url(${item.img || ''})`;

            if (item.location === 'Cocina') {
                badgeBg.classList.add('bg-primary/90');
                badgeIcon.textContent = 'soup_kitchen';
            } else {
                badgeBg.classList.add('bg-blue-500/90');
                badgeIcon.textContent = 'local_bar';
            }

            nameEl.textContent = item.name;
            priceSpan.textContent = formatCurrency(item.price);

            if (item.location === 'Cocina') {
                stockSpan.className = 'text-[10px] uppercase font-bold text-slate-400';
                stockSpan.textContent = item.id;
            } else {
                if (item.stock <= 5) {
                    stockSpan.className = 'bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold animate-pulse';
                    stockSpan.textContent = `STOCK: ${item.stock}`;
                } else {
                    stockSpan.className = 'text-[10px] uppercase font-bold text-slate-400';
                    stockSpan.textContent = item.id;
                }
            }

            el.addEventListener('click', () => addToCart(item));
            menuGrid.appendChild(clone);
        });
    };

    // ── Sincronizar estado de la orden ────────────────────────────────────
    const syncOrderStatus = async () => {
        if (!tableCode) return;
        try {
            const res = await fetchData(ENDPOINTS.waiters.get.orderStatus, { tableCode });
            if (res.success) {
                sentItems = res.data.items || [];
                if (btnPayClose) {
                    const canClose = res.data.canClose;
                    btnPayClose.disabled = !canClose;
                    btnPayClose.className = [
                        'w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-all',
                        canClose ? 'bg-green-600 text-white shadow-green-200' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    ].join(' ');
                }
                renderCart();
            }
        } catch (e) {
            console.error('[Order] Error sincronizando estado:', e);
        }
    };

    // ── Carrito ───────────────────────────────────────────────────────────
    const STATUS_CONFIG = {
        PENDING_KITCHEN: { label: 'En Cola', cls: 'bg-orange-100 text-orange-600', action: null },
        PREPARING: { label: 'Cocinando', cls: 'bg-blue-100 text-blue-600 animate-pulse', action: null },
        READY: { label: 'Listo', cls: 'bg-green-100 text-green-600', action: 'collect' },
        PENDING_FLOOR: { label: 'Piso', cls: 'bg-purple-100 text-purple-600', action: 'collect' },
        COLLECTED: { label: 'Recolectado', cls: 'bg-blue-600 text-white', action: 'deliver' },
        DELIVERED: { label: 'Entregado', cls: 'bg-slate-200 text-slate-500', action: null }
    };

    const renderCart = () => {
        cartItemsContainer.innerHTML = '';
        const tplNew = document.getElementById('tpl-order-cart-new-item');
        const tplSent = document.getElementById('tpl-order-cart-sent-item');

        if (sentItems.length > 0) {
            const header = document.createElement('div');
            header.className = 'text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-wider border-b border-slate-100 pb-1';
            header.textContent = 'Seguimiento de Comanda';
            cartItemsContainer.appendChild(header);

            sentItems.forEach(item => {
                const cfg = STATUS_CONFIG[item.status] || { label: item.status, cls: 'bg-slate-100 text-slate-500', action: null };

                const clone = tplSent.content.cloneNode(true);
                const qtyName = clone.querySelector('.col-qty-name');
                const badge = clone.querySelector('.col-badge');
                const botRow = clone.querySelector('.col-bot-row');

                qtyName.textContent = `${item.quantity}x ${item.name}`;
                badge.className = `col-badge px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.cls}`;
                badge.textContent = cfg.label;

                if (cfg.action) {
                    const actionBtn = document.createElement('button');
                    const isCollect = cfg.action === 'collect';
                    actionBtn.className = `px-2 py-1 ${isCollect ? 'bg-green-600' : 'bg-blue-800'} text-white rounded text-[10px] font-bold`;
                    actionBtn.textContent = isCollect ? 'RECOGER' : 'ENTREGAR';
                    actionBtn.addEventListener('click', () =>
                        isCollect ? collectItem(item.id) : deliverItem(item.id)
                    );
                    botRow.appendChild(actionBtn);
                }

                cartItemsContainer.appendChild(clone);
            });
        }

        if (cart.length > 0) {
            const header = document.createElement('div');
            header.className = 'text-[10px] uppercase font-bold text-slate-400 mt-6 mb-3 tracking-wider border-b border-slate-100 pb-1';
            header.textContent = 'Nueva Canasta';
            cartItemsContainer.appendChild(header);

            cart.forEach(item => {
                const clone = tplNew.content.cloneNode(true);
                const btnPlus = clone.querySelector('.btn-qty-plus');
                const btnMinus = clone.querySelector('.btn-qty-minus');
                const btnRemove = clone.querySelector('.btn-remove');

                clone.querySelector('.col-qty').textContent = item.qty;
                clone.querySelector('.col-name').textContent = item.name;
                clone.querySelector('.col-price').textContent = formatCurrency(item.price * item.qty);
                clone.querySelector('.col-code').textContent = item.id;

                btnPlus.addEventListener('click', () => updateQty(item.id, 1));
                btnMinus.addEventListener('click', () => updateQty(item.id, -1));
                btnRemove.addEventListener('click', () => removeItem(item.id));

                cartItemsContainer.appendChild(clone);
            });

            btnSendKitchen.disabled = false;
            btnSendKitchen.className = 'w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-all bg-primary text-white shadow-primary/30';
        } else {
            btnSendKitchen.disabled = true;
            btnSendKitchen.className = 'w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-all bg-slate-100 text-slate-300 cursor-not-allowed';
        }

        if (cart.length === 0 && sentItems.length === 0) {
            const emptyWrap = document.createElement('div');
            emptyWrap.className = 'h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 italic text-center py-20';
            emptyWrap.innerHTML = `
                <span class="material-symbols-outlined text-6xl mb-2">shopping_basket</span>
                <p>La orden está vacía</p>
            `;
            cartItemsContainer.appendChild(emptyWrap);
        }

        const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
        const tax = subtotal * 0.16;
        cartSubtotal.textContent = formatCurrency(subtotal);
        cartTax.textContent = formatCurrency(tax);
        cartTotal.textContent = formatCurrency(subtotal + tax);
    };

    // ── Acciones del carrito ──────────────────────────────────────────────
    const addToCart = (item) => {
        const existing = cart.find(i => i.id === item.id);
        if (existing) existing.qty++;
        else cart.push({ ...item, qty: 1 });
        renderCart();
    };

    const updateQty = (id, delta) => {
        const item = cart.find(i => i.id === id);
        if (item) { item.qty = Math.max(1, item.qty + delta); renderCart(); }
    };

    const removeItem = (id) => {
        cart = cart.filter(i => i.id !== id);
        renderCart();
    };

    // ── Enviar orden a cocina ─────────────────────────────────────────────
    const sendOrder = async () => {
        if (!cart.length || !employeeNumber || !tableCode) return;
        try {
            await postData(
                ENDPOINTS.waiters.post.orders,
                { employeeNumber, items: cart.map(i => ({ dishCode: i.dishCode, quantity: i.qty, notes: '' })) },
                { tableCode }
            );
            cart = [];
            await syncOrderStatus();
            notificationBanner.classList.remove('hidden');
            setTimeout(() => notificationBanner.classList.add('hidden'), 2000);
        } catch (error) {
            showErrorModal('Error enviando la orden: ' + error.message, 'Error de Envío');
        }
    };

    // ── Recoger ítem ──────────────────────────────────────────────────────
    // FIX #12-collect: collect SÍ envía employeeNumber (lo requiere sp_pos_collect_item)
    const collectItem = async (itemId) => {
        try {
            const res = await putData(
                ENDPOINTS.waiters.put.collectItem,
                { employeeNumber },
                { tableCode, itemId }
            );
            if (res.success) await syncOrderStatus();
        } catch (e) {
            showErrorModal('Error al recoger el ítem: ' + e.message, 'Error');
        }
    };

    // ── Entregar ítem ─────────────────────────────────────────────────────
    // FIX #12-deliver: deliver NO envía body — el SP no requiere identificación adicional.
    // El Gatekeeper Zero Trust rechaza cualquier payload no declarado en el schema.
    const deliverItem = async (itemId) => {
        try {
            const res = await putData(
                ENDPOINTS.waiters.put.deliverItem,
                {},
                { tableCode, itemId }
            );
            if (res.success) await syncOrderStatus();
        } catch (e) {
            showErrorModal('Error al entregar el ítem: ' + e.message, 'Error');
        }
    };

    // ── Cobrar y cerrar mesa ──────────────────────────────────────────────
    const closeTable = async () => {
        if (!employeeNumber || !tableCode) return;
        const confirmed = await confirmAction(`¿Desea cobrar y CERRAR la mesa ${tableCode}?`);
        if (!confirmed) return;
        try {
            await postData(
                ENDPOINTS.waiters.post.closeTable,
                { employeeNumber, paymentMethod: 'EFECTIVO' },
                { tableCode }
            );
            PubSub.publish('ORDER_COMPLETED');
        } catch (error) {
            showErrorModal('Error al intentar cobrar: ' + error.message, 'Error de Cobro');
        }
    };

    // ── Mostrar QR de Mesa ────────────────────────────────────────────────
    const openQrModal = () => {
        if (!tableCode) {
            showErrorModal('No hay mesa asignada para generar el QR.', 'Atención');
            return;
        }

        const tpl = document.getElementById('tpl-modal-qr');
        if (!tpl) return;

        const clone = tpl.content.cloneNode(true);
        const modalBackdrop = clone.querySelector('#modal-qr-backdrop');
        const modalContent = clone.querySelector('#modal-qr-content');
        const qrContainer = clone.querySelector('.col-qr-container');
        const qrTableLabel = clone.querySelector('.col-qr-table');
        const btnClose = clone.querySelector('.btn-close');

        qrTableLabel.textContent = `Mesa ${tableCode}`;

        // Generar QR apuntando al menú público con bind de mesa
        const qrUrl = `${KORE_CONFIG.PROTOCOL}://menu.${KORE_CONFIG.BASE_DOMAIN}/?table=${tableCode}`;

        // Se inyecta temporalmente al DOM para que la librería pueda medir el div
        document.body.appendChild(clone);

        // La clase QRCode es global y viene del qrcode.min.js
        try {
            new QRCode(document.body.lastElementChild.querySelector('.col-qr-container'), {
                text: qrUrl,
                width: 220,
                height: 220,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (err) {
            console.error('[Order] error rendering QR:', err);
        }

        // Animar entrada fluidamente
        requestAnimationFrame(() => {
            modalBackdrop.classList.remove('opacity-0');
            modalContent.classList.remove('opacity-0', 'scale-95');
        });

        // Función de cierre y autodestrucción del modal
        const closeModal = () => {
            modalBackdrop.classList.add('opacity-0');
            modalContent.classList.add('opacity-0', 'scale-95');
            setTimeout(() => modalBackdrop.remove(), 300);
        };

        btnClose.addEventListener('click', closeModal);
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeModal();
        });
    };

    // ── Listeners y arranque ──────────────────────────────────────────────
    [btnHome, btnCloseOrder].forEach(btn => btn?.addEventListener('click', () => PubSub.publish('ORDER_COMPLETED')));
    btnSendKitchen?.addEventListener('click', sendOrder);
    btnPayClose?.addEventListener('click', closeTable);
    btnShowQr?.addEventListener('click', openQrModal);

    loadMenuData();
}