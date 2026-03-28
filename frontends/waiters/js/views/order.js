// waiters/js/views/order.js
import { PubSub } from '/shared/js/pubsub.js';
import { formatCurrency } from '/shared/js/utils.js';
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
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
            const [menuRes, stockRes] = await Promise.all([
                fetchData(ENDPOINTS.menu.get.public),
                fetchData(ENDPOINTS.waiters.get.floorStock)
            ]);

            // menu.get.public devuelve [{categoryCode, categoryName, dishes:[{dishCode, name, price, ...}]}]
            if (menuRes.success && Array.isArray(menuRes.data)) {
                CATEGORIES = menuRes.data.map(cat => ({
                    id: cat.categoryName,
                    code: cat.categoryCode,
                    icon: 'restaurant_menu'
                }));
                activeCategory = CATEGORIES[0]?.id || null;

                // Construir stockMap para cruzar con inventario de piso
                const stockMap = {};
                if (stockRes.success) {
                    const stockArray = stockRes.data?.stock || stockRes.data || [];
                    stockArray.forEach(s => {
                        stockMap[s.item_code || s.code] = parseFloat(s.stock_available ?? s.stock ?? 99);
                    });
                }

                // Aplanar categorías → platillos activos con stock de piso
                MENU_ITEMS = menuRes.data.flatMap(cat =>
                    (cat.dishes || [])
                        .filter(d => d.isActive !== false)
                        .map(d => ({
                            id: d.dishCode,
                            dishCode: d.dishCode,
                            name: d.name,
                            price: parseFloat(d.price),
                            category: cat.categoryName,
                            location: cat.routeToKds ? 'Cocina' : 'Barra',
                            stock: stockMap[d.dishCode] ?? 99,
                            img: d.imageUrl || ''
                        }))
                );
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
        CATEGORIES.forEach(cat => {
            const btn = document.createElement('button');
            const isActive = activeCategory === cat.id;
            btn.className = [
                'px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all shrink-0',
                isActive
                    ? 'bg-primary text-white shadow-primary/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            ].join(' ');

            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-symbols-outlined text-lg';
            iconSpan.textContent = cat.icon;

            btn.appendChild(iconSpan);
            btn.appendChild(document.createTextNode(` ${cat.id}`));

            btn.addEventListener('click', () => {
                activeCategory = cat.id;
                renderCategories();
                renderMenu();
            });
            categoryTabs.appendChild(btn);
        });
    };

    // ── Grid de platillos ─────────────────────────────────────────────────
    const renderMenu = () => {
        menuGrid.innerHTML = '';
        MENU_ITEMS.filter(i => i.category === activeCategory).forEach(item => {
            const el = document.createElement('div');
            el.className = 'group bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 flex flex-col';

            const imgDiv = document.createElement('div');
            imgDiv.className = 'relative h-32 w-full bg-slate-200 dark:bg-slate-700 shrink-0';

            const bgDiv = document.createElement('div');
            bgDiv.className = 'absolute inset-0 bg-cover bg-center';
            bgDiv.style.backgroundImage = `url(${item.img || ''})`;

            const badge = document.createElement('div');
            badge.className = `absolute top-2 right-2 p-1 rounded-lg ${item.location === 'Cocina' ? 'bg-primary/90' : 'bg-blue-500/90'} text-white`;
            const badgeIcon = document.createElement('span');
            badgeIcon.className = 'material-symbols-outlined text-sm block';
            badgeIcon.textContent = item.location === 'Cocina' ? 'soup_kitchen' : 'local_bar';
            badge.appendChild(badgeIcon);

            imgDiv.appendChild(bgDiv);
            imgDiv.appendChild(badge);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'p-3 flex flex-col justify-between flex-1';

            const nameEl = document.createElement('h3');
            nameEl.className = 'font-bold text-sm leading-tight group-hover:text-primary transition-colors';
            nameEl.textContent = item.name;

            const footerDiv = document.createElement('div');
            footerDiv.className = 'flex items-center justify-between mt-2';

            const priceSpan = document.createElement('span');
            priceSpan.className = 'text-primary font-bold';
            priceSpan.textContent = formatCurrency(item.price);

            const rightSpan = document.createElement('span');
            if (item.stock <= 5) {
                rightSpan.className = 'bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold animate-pulse';
                rightSpan.textContent = `STOCK: ${item.stock}`;
            } else {
                rightSpan.className = 'text-[10px] uppercase font-bold text-slate-400';
                rightSpan.textContent = item.id;
            }

            footerDiv.appendChild(priceSpan);
            footerDiv.appendChild(rightSpan);
            infoDiv.appendChild(nameEl);
            infoDiv.appendChild(footerDiv);

            el.appendChild(imgDiv);
            el.appendChild(infoDiv);
            el.addEventListener('click', () => addToCart(item));
            menuGrid.appendChild(el);
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

        if (sentItems.length > 0) {
            const header = document.createElement('div');
            header.className = 'text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-wider border-b border-slate-100 pb-1';
            header.textContent = 'Seguimiento de Comanda';
            cartItemsContainer.appendChild(header);

            sentItems.forEach(item => {
                const cfg = STATUS_CONFIG[item.status] || { label: item.status, cls: 'bg-slate-100 text-slate-500', action: null };

                const row = document.createElement('div');
                row.className = 'flex items-start gap-3 py-2 border-b border-slate-50 last:border-0';

                const info = document.createElement('div');
                info.className = 'flex-1';

                const topRow = document.createElement('div');
                topRow.className = 'flex justify-between items-center font-medium text-xs';

                const itemLabel = document.createElement('span');
                itemLabel.textContent = `${item.quantity}x ${item.name}`;

                const badge = document.createElement('span');
                badge.className = `px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.cls}`;
                badge.textContent = cfg.label;

                topRow.appendChild(itemLabel);
                topRow.appendChild(badge);

                const botRow = document.createElement('div');
                botRow.className = 'flex justify-between items-center mt-1';

                const sentTag = document.createElement('span');
                sentTag.className = 'text-[10px] text-slate-400 italic';
                sentTag.textContent = 'Enviado';
                botRow.appendChild(sentTag);

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

                info.appendChild(topRow);
                info.appendChild(botRow);
                row.appendChild(info);
                cartItemsContainer.appendChild(row);
            });
        }

        if (cart.length > 0) {
            const header = document.createElement('div');
            header.className = 'text-[10px] uppercase font-bold text-slate-400 mt-6 mb-3 tracking-wider border-b border-slate-100 pb-1';
            header.textContent = 'Nueva Canasta';
            cartItemsContainer.appendChild(header);

            cart.forEach(item => {
                const el = document.createElement('div');
                el.className = 'flex items-start gap-4 fade-in py-2';

                const qtyCol = document.createElement('div');
                qtyCol.className = 'flex flex-col items-center';

                const btnPlus = document.createElement('button');
                btnPlus.className = 'w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary';
                const plusIcon = document.createElement('span');
                plusIcon.className = 'material-symbols-outlined text-sm pointer-events-none';
                plusIcon.textContent = 'add';
                btnPlus.appendChild(plusIcon);

                const qtySpan = document.createElement('span');
                qtySpan.className = 'font-bold py-1 text-sm';
                qtySpan.textContent = item.qty;

                const btnMinus = document.createElement('button');
                btnMinus.className = 'w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary';
                const minusIcon = document.createElement('span');
                minusIcon.className = 'material-symbols-outlined text-sm pointer-events-none';
                minusIcon.textContent = 'remove';
                btnMinus.appendChild(minusIcon);

                qtyCol.appendChild(btnPlus);
                qtyCol.appendChild(qtySpan);
                qtyCol.appendChild(btnMinus);

                const infoDiv = document.createElement('div');
                infoDiv.className = 'flex-1';

                const topRow = document.createElement('div');
                topRow.className = 'flex justify-between font-medium text-sm';
                const nameEl = document.createElement('span');
                nameEl.textContent = item.name;
                const priceEl = document.createElement('span');
                priceEl.textContent = formatCurrency(item.price * item.qty);
                topRow.appendChild(nameEl);
                topRow.appendChild(priceEl);

                const codeEl = document.createElement('p');
                codeEl.className = 'text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold';
                codeEl.textContent = item.id;
                infoDiv.appendChild(topRow);
                infoDiv.appendChild(codeEl);

                const btnRemove = document.createElement('button');
                btnRemove.className = 'text-slate-300 hover:text-red-500';
                const removeIcon = document.createElement('span');
                removeIcon.className = 'material-symbols-outlined text-lg pointer-events-none';
                removeIcon.textContent = 'delete';
                btnRemove.appendChild(removeIcon);

                btnPlus.addEventListener('click', () => updateQty(item.id, 1));
                btnMinus.addEventListener('click', () => updateQty(item.id, -1));
                btnRemove.addEventListener('click', () => removeItem(item.id));

                el.appendChild(qtyCol);
                el.appendChild(infoDiv);
                el.appendChild(btnRemove);
                cartItemsContainer.appendChild(el);
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
            const emptyIcon = document.createElement('span');
            emptyIcon.className = 'material-symbols-outlined text-6xl mb-2';
            emptyIcon.textContent = 'shopping_basket';
            const emptyText = document.createElement('p');
            emptyText.textContent = 'La orden está vacía';
            emptyWrap.appendChild(emptyIcon);
            emptyWrap.appendChild(emptyText);
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

    // ── Listeners y arranque ──────────────────────────────────────────────
    [btnHome, btnCloseOrder].forEach(btn => btn?.addEventListener('click', () => PubSub.publish('ORDER_COMPLETED')));
    btnSendKitchen?.addEventListener('click', sendOrder);
    btnPayClose?.addEventListener('click', closeTable);

    loadMenuData();
}