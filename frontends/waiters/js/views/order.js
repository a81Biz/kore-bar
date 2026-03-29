// frontends/waiters/js/views/order.js
import { PubSub } from '/shared/js/pubsub.js';
import { formatCurrency } from '/shared/js/utils.js';
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { KORE_CONFIG } from '/core/js/kore.config.js';
import { showErrorModal, confirmAction } from '/shared/js/ui.js';

export async function mount(container, data = {}) {
    let cart = [];
    let sentItems = [];
    let activeCategory = null;
    let MENU_ITEMS = [];
    let CATEGORIES = [];
    let syncTimer = null;

    const { tableCode, status, waiterName, authData } = data;
    const employeeNumber = authData?.employeeNumber;

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

    // FIX: Cambiar "Enviar a Cocina" → "Enviar Orden" (no todos los items van a cocina)
    if (btnSendKitchen) {
        const textNode = [...btnSendKitchen.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.textContent = ' Enviar Orden';
        else {
            const icon = btnSendKitchen.querySelector('.material-symbols-outlined');
            btnSendKitchen.textContent = '';
            if (icon) btnSendKitchen.appendChild(icon);
            btnSendKitchen.appendChild(document.createTextNode(' Enviar Orden'));
        }
    }

    // ── Sesión de mesa ────────────────────────────────────────────────────
    const ensureTableSession = async () => {
        if (!tableCode) return;
        if (status === 'OCCUPIED') { await syncOrderStatus(); return; }
        try {
            await postData(ENDPOINTS.waiters.post.openTable, { employeeNumber, diners: 2 }, { tableCode });
        } catch (e) {
            console.warn('[Order] Error abriendo sesión de mesa:', e);
        }
    };

    // ── Carga de menú ─────────────────────────────────────────────────────
    const loadMenuData = async () => {
        try {
            const stockRes = await fetchData(ENDPOINTS.waiters.get.floorStock);
            if (stockRes.success) {
                const stockArray = stockRes.data?.stock || stockRes.data || [];
                const catMap = new Map();
                MENU_ITEMS = stockArray.map(d => {
                    if (!catMap.has(d.categoryCode)) {
                        catMap.set(d.categoryCode, { id: d.categoryName, code: d.categoryCode, icon: 'restaurant_menu' });
                    }
                    return {
                        id: d.dishCode,
                        dishCode: d.dishCode,
                        name: d.name,
                        price: parseFloat(d.price),
                        category: d.categoryName,
                        location: d.routeToKds ? 'Cocina' : 'Barra',
                        isKitchen: !!d.routeToKds,  // FIX: flag booleano para uso en UI
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

    const renderCategories = () => {
        categoryTabs.innerHTML = '';
        const tpl = document.getElementById('tpl-order-category-tab');
        CATEGORIES.forEach(cat => {
            const clone = tpl.content.cloneNode(true);
            const btn = clone.querySelector('button');
            const isActive = activeCategory === cat.id;
            btn.className = isActive
                ? 'px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all shrink-0 bg-primary text-white shadow-primary/20'
                : 'px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all shrink-0 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50';
            clone.querySelector('.col-icon').textContent = cat.icon;
            clone.querySelector('.col-name').textContent = cat.id;
            btn.addEventListener('click', () => { activeCategory = cat.id; renderCategories(); renderMenu(); });
            categoryTabs.appendChild(clone);
        });
    };

    const renderMenu = () => {
        menuGrid.innerHTML = '';
        const tpl = document.getElementById('tpl-order-menu-item');
        MENU_ITEMS.filter(i => i.category === activeCategory).forEach(item => {
            const clone = tpl.content.cloneNode(true);
            const el = clone.querySelector('.group');
            clone.querySelector('.col-img').style.backgroundImage = `url(${item.img || ''})`;
            const badgeBg = clone.querySelector('.col-badge-bg');
            const badgeIcon = clone.querySelector('.col-badge-icon');
            if (item.location === 'Cocina') {
                badgeBg.classList.add('bg-primary/90');
                badgeIcon.textContent = 'soup_kitchen';
            } else {
                badgeBg.classList.add('bg-blue-500/90');
                badgeIcon.textContent = 'local_bar';
            }
            clone.querySelector('.col-name').textContent = item.name;
            clone.querySelector('.col-price').textContent = formatCurrency(item.price);
            const stockSpan = clone.querySelector('.col-stock');
            if (item.location !== 'Cocina' && item.stock <= 5) {
                stockSpan.className = 'bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold animate-pulse';
                stockSpan.textContent = `STOCK: ${item.stock}`;
            } else {
                stockSpan.className = 'text-[10px] uppercase font-bold text-slate-400';
                stockSpan.textContent = item.id;
            }
            el.addEventListener('click', () => addToCart(item));
            menuGrid.appendChild(clone);
        });
    };

    // ── Sincronizar comanda ───────────────────────────────────────────────
    const syncOrderStatus = async () => {
        if (!tableCode) return;
        try {
            const res = await fetchData(ENDPOINTS.waiters.get.orderStatus, { tableCode });
            if (res.success) {
                // FIX: Los items vienen en res.data.body.items (schema template response),
                // NO en res.data.items. Antes siempre era undefined → sentItems = [] → comanda vacía.
                sentItems = res.data?.body?.items
                    || res.data?.items
                    || [];

                const canClose = res.data?.body?.canClose ?? res.data?.canClose ?? false;

                if (btnPayClose) {
                    btnPayClose.disabled = !canClose;
                    btnPayClose.className = [
                        'w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-3 active:scale-[0.98] transition-all',
                        canClose
                            ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    ].join(' ');
                }
                renderCart();
            }
        } catch (e) {
            console.error('[Order] Error sincronizando estado:', e);
        }
    };

    // FIX: Polling periódico de comanda mientras haya items activos
    // Evita que el mesero tenga que refrescar manualmente para ver el estado de cocina.
    const startSyncPolling = () => {
        stopSyncPolling();
        syncTimer = setInterval(() => {
            if (!document.hidden && sentItems.length > 0) {
                const hasActive = sentItems.some(i =>
                    ['PENDING_KITCHEN', 'PREPARING', 'PENDING_FLOOR', 'COLLECTED'].includes(i.status)
                );
                if (hasActive) syncOrderStatus();
            }
        }, 10000);
    };

    const stopSyncPolling = () => {
        if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
    };

    // ── Carrito ───────────────────────────────────────────────────────────
    // FIX: Labels más descriptivos para el mesero
    const STATUS_CONFIG = {
        PENDING_KITCHEN: { label: 'En Cola 🍳', cls: 'bg-orange-100 text-orange-600', action: null },
        PREPARING: { label: 'Cocinando', cls: 'bg-blue-100 text-blue-600 animate-pulse', action: null },
        READY: { label: '✅ Listo', cls: 'bg-green-100 text-green-700 font-black', action: 'collect' },
        PENDING_FLOOR: { label: 'Por Recoger 🍹', cls: 'bg-purple-100 text-purple-600', action: 'collect' },
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
                clone.querySelector('.col-qty').textContent = item.qty;
                clone.querySelector('.col-name').textContent = item.name;
                clone.querySelector('.col-price').textContent = formatCurrency(item.price * item.qty);

                // FIX: Badge de destino visible antes de enviar
                const codeEl = clone.querySelector('.col-code');
                if (codeEl) {
                    codeEl.textContent = item.id;
                    const tag = document.createElement('span');
                    tag.className = item.isKitchen
                        ? 'ml-1 bg-orange-100 text-orange-600 text-[9px] font-bold px-1 py-0.5 rounded uppercase'
                        : 'ml-1 bg-blue-100 text-blue-600 text-[9px] font-bold px-1 py-0.5 rounded uppercase';
                    tag.textContent = item.isKitchen ? 'Cocina' : 'Barra';
                    codeEl.appendChild(tag);
                }

                clone.querySelector('.btn-qty-plus').addEventListener('click', () => updateQty(item.id, 1));
                clone.querySelector('.btn-qty-minus').addEventListener('click', () => updateQty(item.id, -1));
                clone.querySelector('.btn-remove').addEventListener('click', () => removeItem(item.id));
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
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-6xl mb-2';
            icon.textContent = 'shopping_basket';
            const p = document.createElement('p');
            p.textContent = 'La orden está vacía';
            emptyWrap.appendChild(icon);
            emptyWrap.appendChild(p);
            cartItemsContainer.appendChild(emptyWrap);
        }

        const newSubtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
        const sentSubtotal = sentItems.reduce((acc, i) => {
            const price = parseFloat(i.unit_price ?? i.unitPrice ?? i.price ?? 0);
            const qty = parseInt(i.quantity ?? i.qty ?? 1, 10);
            return acc + price * qty;
        }, 0);
        const subtotal = newSubtotal + sentSubtotal;
        const tax = subtotal * 0.16;
        cartSubtotal.textContent = formatCurrency(subtotal);
        cartTax.textContent = formatCurrency(tax);
        cartTotal.textContent = formatCurrency(subtotal + tax);
    };

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

    // ── Enviar orden ──────────────────────────────────────────────────────
    const sendOrder = async () => {
        if (!cart.length || !employeeNumber || !tableCode) return;
        try {
            await postData(
                ENDPOINTS.waiters.post.orders,
                { employeeNumber, items: cart.map(i => ({ dishCode: i.dishCode, quantity: i.qty, notes: '' })) },
                { tableCode }
            );
            cart = [];
            renderCart(); // limpiar canasta optimistamente
            notificationBanner.classList.remove('hidden');
            setTimeout(() => notificationBanner.classList.add('hidden'), 2500);
            // FIX: pequeño delay antes de sincronizar — da tiempo al backend de persistir
            setTimeout(async () => {
                await syncOrderStatus();
                startSyncPolling();
            }, 600);
        } catch (error) {
            showErrorModal('Error enviando la orden: ' + error.message, 'Error de Envío');
        }
    };

    const collectItem = async (itemId) => {
        try {
            const res = await putData(ENDPOINTS.waiters.put.collectItem, { employeeNumber }, { tableCode, itemId });
            if (res.success) await syncOrderStatus();
        } catch (e) {
            showErrorModal('Error al recoger el ítem: ' + e.message, 'Error');
        }
    };

    const deliverItem = async (itemId) => {
        try {
            const res = await putData(ENDPOINTS.waiters.put.deliverItem, {}, { tableCode, itemId });
            if (res.success) await syncOrderStatus();
        } catch (e) {
            showErrorModal('Error al entregar el ítem: ' + e.message, 'Error');
        }
    };

    const closeTable = async () => {
        if (!employeeNumber || !tableCode) return;
        const confirmed = await confirmAction(`¿Desea cobrar y CERRAR la mesa ${tableCode}?`);
        if (!confirmed) return;
        try {
            await postData(ENDPOINTS.waiters.post.closeTable, { employeeNumber, paymentMethod: 'EFECTIVO' }, { tableCode });
            stopSyncPolling();
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


    // ── Eventos ───────────────────────────────────────────────────────────

    btnHome?.addEventListener('click', () => { stopSyncPolling(); PubSub.publish('ORDER_COMPLETED'); });
    btnCloseOrder?.addEventListener('click', async () => {
        const ok = await confirmAction('¿Regresar al dashboard sin cerrar la mesa?');
        if (ok) { stopSyncPolling(); PubSub.publish('ORDER_COMPLETED'); }
    });
    btnSendKitchen?.addEventListener('click', sendOrder);
    btnPayClose?.addEventListener('click', closeTable);
    btnShowQr?.addEventListener('click', openQrModal);


    // ── Boot ──────────────────────────────────────────────────────────────
    await ensureTableSession();
    await loadMenuData();
    await syncOrderStatus();
    if (sentItems.length > 0) startSyncPolling();

}