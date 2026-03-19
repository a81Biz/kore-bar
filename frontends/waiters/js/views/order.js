// waiters/js/views/order.js
import { PubSub } from '/shared/js/pubsub.js';
import { formatCurrency } from '/shared/js/utils.js';
import { postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

export async function mount(container, data = {}) {
    // Isolated Component States
    let cart = [];
    let sentItems = [];
    let activeCategory = "Tacos";
    let MENU_ITEMS = [];
    let CATEGORIES = [];
    
    // Auth and Table Params from the Dashboard context
    const { tableCode, status, waiterName, authData } = data;
    const employeeNumber = authData?.employeeNumber;

    const { ENDPOINTS } = await import('/shared/js/endpoints.js');
    const { fetchData, postData } = await import('/shared/js/http.client.js');

    // DOM Mappings
    const btnHome = container.querySelector('#btn-home');
    const btnCloseOrder = container.querySelector('#btn-close-order');
    const categoryTabs = container.querySelector('#category-tabs');
    const menuGrid = container.querySelector('#menu-grid');

    // Cart DOM
    const cartTableLabel = container.querySelector('#cart-table-label');
    const cartTime = container.querySelector('#cart-time');
    const cartItemsContainer = container.querySelector('#cart-items-container');
    const cartSubtotal = container.querySelector('#cart-subtotal');
    const cartTax = container.querySelector('#cart-tax');
    const cartTotal = container.querySelector('#cart-total');
    const btnSendKitchen = container.querySelector('#btn-send-kitchen');
    const notificationBanner = container.querySelector('#notification-banner');

    const btnPayClose = container.querySelector('#btn-pay-close');

    // 1. Initial State Sync
    cartTableLabel.textContent = tableCode ? `Mesa ${tableCode}` : 'Nueva Orden';
    cartTime.textContent = new Date().toLocaleTimeString('es-MX', { weekday: 'long', hour: '2-digit', minute: '2-digit' });

    // Open table session proactively if available
    const ensureTableSession = async () => {
        if (!tableCode) return;
        if (status === 'OCCUPIED') {
            await syncOrderStatus();
            return;
        }
        try {
            await postData(ENDPOINTS.waiters.post.openTable, { employeeNumber, diners: 2 }, { tableCode });
        } catch(e) {
            console.warn("Failed opening table session actively:", e);
        }
    };
    ensureTableSession();

    // 2. Data fetching
    const loadMenuData = async () => {
        try {
            const catRes = await fetchData(ENDPOINTS.admin.get.menuCategories);
            if (catRes.success) {
                CATEGORIES = catRes.data.map(c => ({ id: c.name, icon: 'restaurant_menu' }));
                if (CATEGORIES.length > 0) activeCategory = CATEGORIES[0].id;
            }

            const stockRes = await fetchData(ENDPOINTS.inventory.get.stock, { location: 'LOC-PISO' });
            const stockMap = {};
            if (stockRes.success && stockRes.data.stock) {
                stockRes.data.stock.forEach(s => { stockMap[s.item_code] = parseFloat(s.stock_available); });
            }

            const dishRes = await fetchData(ENDPOINTS.admin.get.menuDishes);
            if (dishRes.success) {
                MENU_ITEMS = dishRes.data.filter(d => d.is_active).map(d => ({
                    id: d.code,
                    dishCode: d.code,
                    name: d.name,
                    price: parseFloat(d.price),
                    category: d.category_name,
                    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDaMsuEg9Hjvm6LLFkUMupKXKLLTvGt4T6p5TkRZO29VTkHRuGEa8nO9D0VCZhmAnmIow2u5aVwNAnbYbQZns-Fz_j-KAPeHjVB_0N2KS-O1oufkfkKszZBZtckxold3WEmzdpbGoeEcIRYqUqD5eiHKhXGEfo9J0NxbMfGph4zO2WYGvrigp1SkhTaXerv8iNNNOgbr-_mKva9VM3fhKMIwvhWI6ZcrC2nFZM4bwbzDjlT4Un023h76aPcg9uZXgmaILj24ijfJWnV",
                    location: d.has_recipe ? "Cocina" : "Piso",
                    stock: stockMap[d.code] ?? 99
                }));
            }

            renderCategories();
            renderMenu();
        } catch(e) {
            console.error("Failed loading menu data", e);
        }
    };

    // 3. Render Functions
    const renderCategories = () => {
        categoryTabs.innerHTML = '';
        CATEGORIES.forEach(cat => {
            const btn = document.createElement('button');
            const isActive = activeCategory === cat.id;
            btn.className = `px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all shrink-0 ${isActive ? 'bg-primary text-white shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`;
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

    const renderMenu = () => {
        menuGrid.innerHTML = '';
        const items = MENU_ITEMS.filter(i => i.category === activeCategory);

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = "group bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 flex flex-col";
            el.innerHTML = `
                <div class="relative h-32 w-full bg-slate-200 dark:bg-slate-700 shrink-0">
                    <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(${item.img})"></div>
                    <div class="absolute top-2 right-2 p-1 rounded-lg ${item.location === 'Cocina' ? 'bg-primary/90' : 'bg-blue-500/90'} text-white">
                        <span class="material-symbols-outlined text-sm block">
                            ${item.location === 'Cocina' ? 'soup_kitchen' : 'kitchen'}
                        </span>
                    </div>
                </div>
                <div class="p-3 flex flex-col justify-between flex-1">
                    <h3 class="font-bold text-sm leading-tight group-hover:text-primary transition-colors">${item.name}</h3>
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-primary font-bold">${formatCurrency(item.price)}</span>
                        ${item.stock <= 5 ? `<span class="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold animate-pulse">STOCK: ${item.stock}</span>` : `<span class="text-[10px] uppercase font-bold text-slate-400">${item.id}</span>`}
                    </div>
                </div>
            `;
            el.addEventListener('click', () => addToCart(item));
            menuGrid.appendChild(el);
        });
    };
    
    const syncOrderStatus = async () => {
        if (!tableCode) return;
        try {
            const res = await fetchData(ENDPOINTS.waiters.get.orderStatus, { tableCode });
            if (res.success) {
                sentItems = res.data.items || [];
                
                // Actualizar candado de pago
                if (btnPayClose) {
                    const canClose = res.data.canClose;
                    btnPayClose.disabled = !canClose;
                    btnPayClose.className = `w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-all ${canClose ? 'bg-green-600 text-white shadow-green-200' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`;
                }
                
                renderCart();
            }
        } catch (e) {
            console.error("Failed syncing order status", e);
        }
    };

    const renderCart = () => {
        cartItemsContainer.innerHTML = '';

        // SECCIÓN 1: Items ya enviados (Seguimiento)
        if (sentItems.length > 0) {
            const header = document.createElement('div');
            header.className = "text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-wider border-b border-slate-100 pb-1";
            header.textContent = "Seguimiento de Comanda";
            cartItemsContainer.appendChild(header);

            sentItems.forEach(item => {
                const el = document.createElement('div');
                el.className = "flex items-start gap-3 py-2 border-b border-slate-50 last:border-0";
                
                let statusBadge = '';
                let actionBtn = '';

                switch(item.status) {
                    case 'PENDING_KITCHEN':
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-orange-100 text-orange-600 font-bold uppercase">En Cola</span>';
                        break;
                    case 'PREPARING':
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-600 font-bold uppercase animate-pulse">Cocinando</span>';
                        break;
                    case 'READY':
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-600 font-bold uppercase">Listo</span>';
                        actionBtn = '<button class="btn-collect px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold">RECOGER</button>';
                        break;
                    case 'PENDING_FLOOR':
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-600 font-bold uppercase">Piso</span>';
                        actionBtn = '<button class="btn-collect px-2 py-1 bg-purple-600 text-white rounded text-[10px] font-bold">RECOGER</button>';
                        break;
                    case 'COLLECTED':
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-600 text-white font-bold uppercase">Recolectado</span>';
                        actionBtn = '<button class="btn-deliver px-2 py-1 bg-blue-800 text-white rounded text-[10px] font-bold">ENTREGAR</button>';
                        break;
                    case 'DELIVERED':
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-500 font-bold uppercase">Entregado</span>';
                        break;
                }

                el.innerHTML = `
                    <div class="flex-1">
                        <div class="flex justify-between items-center font-medium text-xs">
                            <span>${item.quantity}x ${item.name}</span>
                            ${statusBadge}
                        </div>
                        <div class="flex justify-between items-center mt-1">
                             <span class="text-[10px] text-slate-400 italic">Enviado</span>
                             ${actionBtn}
                        </div>
                    </div>
                `;

                if (actionBtn.includes('btn-collect')) {
                    el.querySelector('.btn-collect').addEventListener('click', () => collectItem(item.id));
                }
                if (actionBtn.includes('btn-deliver')) {
                    el.querySelector('.btn-deliver').addEventListener('click', () => deliverItem(item.id));
                }

                cartItemsContainer.appendChild(el);
            });
        }

        // SECCIÓN 2: Items por enviar (Canasta)
        if (cart.length > 0) {
            const header = document.createElement('div');
            header.className = "text-[10px] uppercase font-bold text-slate-400 mt-6 mb-3 tracking-wider border-b border-slate-100 pb-1";
            header.textContent = "Nueva Canasta";
            cartItemsContainer.appendChild(header);

            cart.forEach(item => {
                const el = document.createElement('div');
                el.className = "flex items-start gap-4 fade-in py-2";
                el.innerHTML = `
                    <div class="flex flex-col items-center">
                        <button class="btn-qty-plus w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary">
                            <span class="material-symbols-outlined text-sm pointer-events-none">add</span>
                        </button>
                        <span class="font-bold py-1 text-sm">${item.qty}</span>
                        <button class="btn-qty-minus w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary">
                            <span class="material-symbols-outlined text-sm pointer-events-none">remove</span>
                        </button>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between font-medium text-sm">
                            <span>${item.name}</span>
                            <span>${formatCurrency(item.price * item.qty)}</span>
                        </div>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">${item.id}</p>
                    </div>
                    <button class="btn-remove text-slate-300 hover:text-red-500">
                        <span class="material-symbols-outlined text-lg pointer-events-none">delete</span>
                    </button>
                `;

                el.querySelector('.btn-qty-plus').addEventListener('click', () => updateQty(item.id, 1));
                el.querySelector('.btn-qty-minus').addEventListener('click', () => updateQty(item.id, -1));
                el.querySelector('.btn-remove').addEventListener('click', () => removeItem(item.id));

                cartItemsContainer.appendChild(el);
            });
            btnSendKitchen.disabled = false;
            btnSendKitchen.className = "w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-all bg-primary text-white shadow-primary/30";
        } else {
            btnSendKitchen.disabled = true;
            btnSendKitchen.className = "w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-all bg-slate-100 text-slate-300 cursor-not-allowed";
        }

        if (cart.length === 0 && sentItems.length === 0) {
            const emptyContainer = document.createElement('div');
            emptyContainer.className = 'h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 italic text-center py-20';
            emptyContainer.innerHTML = `
                <span class="material-symbols-outlined text-6xl mb-2">shopping_basket</span>
                <p>La orden está vacía</p>
            `;
            cartItemsContainer.appendChild(emptyContainer);
        }

        // Calculations
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;

        cartSubtotal.textContent = formatCurrency(subtotal);
        cartTax.textContent = formatCurrency(tax);
        cartTotal.textContent = formatCurrency(total);
    };

    // 4. Cart Logic Actions
    const addToCart = (item) => {
        const existing = cart.find(i => i.id === item.id);
        if (existing) {
            existing.qty++;
        } else {
            cart.push({ ...item, qty: 1 });
        }
        renderCart();
    };

    const updateQty = (id, delta) => {
        const item = cart.find(i => i.id === id);
        if (item) {
            item.qty += delta;
            if (item.qty < 1) item.qty = 1;
            renderCart();
        }
    };

    const removeItem = (id) => {
        cart = cart.filter(i => i.id !== id);
        renderCart();
    };

    const sendOrder = async () => {
        if (cart.length === 0 || !employeeNumber || !tableCode) return;

        const payload = {
            employeeNumber: employeeNumber,
            items: cart.map(i => ({ dishCode: i.dishCode, quantity: i.qty, notes: "" }))
        };

        try {
            await postData(ENDPOINTS.waiters.post.orders, payload, { tableCode });

            // Nuke Visual Cart
            cart = [];
            
            // Sync status to show the new items
            await syncOrderStatus();

            // Toggle Visual Response 
            notificationBanner.classList.remove('hidden');
            setTimeout(() => {
                notificationBanner.classList.add('hidden');
            }, 2000);

        } catch (error) {
            console.error("Workflow Pipeline failure", error);
            alert("Error enviando el flujo a Hono: " + error.message);
        }
    };

    const collectItem = async (itemId) => {
        try {
            const res = await postData(ENDPOINTS.waiters.put.collectItem, { employeeNumber }, { tableCode, itemId });
            if (res.success) {
                await syncOrderStatus();
            }
        } catch (e) {
            console.error("Failed collecting item", e);
            alert("Error al recoger: " + e.message);
        }
    };

    const deliverItem = async (itemId) => {
        try {
            const res = await postData(ENDPOINTS.waiters.put.deliverItem, { employeeNumber }, { tableCode, itemId });
            if (res.success) {
                await syncOrderStatus();
            }
        } catch (e) {
            console.error("Failed delivering item", e);
            alert("Error al entregar: " + e.message);
        }
    };

    const closeTable = async () => {
        if (!employeeNumber || !tableCode) return;

        // User confirmation natively
        if (!confirm(`¿Desea cobrar y CERRAR la mesa ${tableCode}?`)) return;

        const payload = {
            employeeNumber: employeeNumber,
            paymentMethod: "EFECTIVO"
        };

        try {
            await postData(ENDPOINTS.waiters.post.closeTable, payload, { tableCode });
            
            // Go back to dashboard on success
            PubSub.publish('ORDER_COMPLETED');
        } catch (error) {
            console.error("Workflow Pipeline failure", error);
            alert("Error al intentar cobrar: " + error.message);
        }
    };

    // 5. Register Listeners & Bootstrap Module Data Natively
    [btnHome, btnCloseOrder].forEach(btn => btn?.addEventListener('click', () => PubSub.publish('ORDER_COMPLETED')));
    btnSendKitchen?.addEventListener('click', sendOrder);
    btnPayClose?.addEventListener('click', closeTable);

    // Initial Bootstrap Data Load
    loadMenuData();
}
