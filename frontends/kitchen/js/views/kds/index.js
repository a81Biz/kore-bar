import { PubSub } from '/shared/js/pubsub.js';
import { fetchData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';

// 1. ESTADO PRIVADO
const state = {
    dom: {},
    items: [],
    pollingInterval: null,
    timerInterval: null
};

// 2. CACHÉ DE DOM
const _cacheDOM = (container) => {
    // Clonar template inicial
    const template = document.getElementById('tpl-kitchen-kds');
    container.innerHTML = '';
    container.appendChild(template.content.cloneNode(true));

    state.dom.root = container;
    state.dom.colPending = container.querySelector('#col-pending');
    state.dom.colPreparing = container.querySelector('#col-preparing');
    state.dom.colReady = container.querySelector('#col-ready');
    
    state.dom.countPending = container.querySelector('#count-pending');
    state.dom.countPreparing = container.querySelector('#count-preparing');
    state.dom.countReady = container.querySelector('#count-ready');

    state.dom.navButtons = container.querySelectorAll('[data-nav]');
    state.dom.btnClockIn = container.querySelector('[data-action="open-pin-modal"]');
};

const _bindEvents = () => {
    state.dom.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-nav');
            if (targetView) PubSub.publish('NAVIGATE', targetView);
        });
    });

    if (state.dom.btnClockIn) {
        state.dom.btnClockIn.addEventListener('click', () => {
             PubSub.publish('OPEN_MODAL', 'pin-modal');
        });
    }
};

// 3. LÓGICA DE NEGOCIO (BOARD)

const fetchBoardData = async () => {
    try {
        const res = await fetchData(ENDPOINTS.kitchen.get.board);
        if (res.success) {
            state.items = res.data || [];
            renderBoard();
        }
    } catch (e) {
        console.error("[KDS] Error fetching board", e);
    }
};

const renderBoard = () => {
    // Limpiar columnas
    state.dom.colPending.innerHTML = '';
    state.dom.colPreparing.innerHTML = '';
    state.dom.colReady.innerHTML = '';

    const groups = {
        PENDING_KITCHEN: [],
        PREPARING: [],
        READY: []
    };

    state.items.forEach(item => {
        if (groups[item.status]) groups[item.status].push(item);
    });

    // Actualizar contadores
    state.dom.countPending.textContent = groups.PENDING_KITCHEN.length;
    state.dom.countPreparing.textContent = groups.PREPARING.length;
    state.dom.countReady.textContent = groups.READY.length;

    // Renderizar tarjetas por grupo
    Object.keys(groups).forEach(status => {
        const items = groups[status];
        const container = status === 'PENDING_KITCHEN' ? state.dom.colPending : 
                          status === 'PREPARING' ? state.dom.colPreparing : state.dom.colReady;

        items.forEach(item => {
            container.appendChild(createOrderCard(item));
        });
    });
};

const createOrderCard = (item) => {
    const template = document.getElementById('tpl-kds-order-card');
    const card = template.content.cloneNode(true);
    const root = card.querySelector('div');

    root.querySelector('.col-mesa').textContent = `Mesa ${item.table_code || '--'}`;
    root.querySelector('.col-ticket').textContent = `#${item.order_code}`;
    root.querySelector('.col-mesero').textContent = item.waiter_name || 'Personal';
    
    // Timer setup
    const timerEl = root.querySelector('.col-tiempo');
    const startTime = new Date(item.started_at || item.created_at).getTime();
    root.setAttribute('data-start-time', startTime);
    root.classList.add('kds-card');

    // Item details
    const itemsContainer = root.querySelector('.col-items');
    itemsContainer.innerHTML = `
        <div class="flex justify-between items-center text-white font-bold">
            <span>${item.quantity}x ${item.name}</span>
        </div>
    `;

    // Actions
    const actionsContainer = root.querySelector('.col-actions');
    if (item.status === 'PENDING_KITCHEN') {
        const btn = document.createElement('button');
        btn.className = "flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 rounded-lg transition-colors uppercase text-sm tracking-widest";
        btn.textContent = "COMENZAR";
        btn.onclick = () => updateItemStatus(item.id, 'PREPARING');
        actionsContainer.appendChild(btn);
    } else if (item.status === 'PREPARING') {
        root.classList.replace('border-amber-500', 'border-orange-500');
        const btn = document.createElement('button');
        btn.className = "flex-1 bg-orange-500 hover:bg-orange-400 text-white font-black py-3 rounded-lg transition-colors uppercase text-sm tracking-widest";
        btn.textContent = "LISTO";
        btn.onclick = () => updateItemStatus(item.id, 'READY');
        actionsContainer.appendChild(btn);
    } else if (item.status === 'READY') {
        root.classList.replace('border-amber-500', 'border-emerald-500');
        root.querySelector('.col-tiempo').classList.replace('text-slate-300', 'text-emerald-400');
    }

    return card;
};

const updateItemStatus = async (itemId, newStatus) => {
    try {
        const res = await putData(ENDPOINTS.kitchen.put.itemStatus, { status: newStatus }, { itemId });
        if (res.success) {
            await fetchBoardData();
        }
    } catch (e) {
        alert("Error al actualizar estado: " + e.message);
    }
};

const startTimers = () => {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        const cards = document.querySelectorAll('.kds-card');
        const now = Date.now();
        cards.forEach(card => {
            const start = parseInt(card.getAttribute('data-start-time'));
            const diff = Math.floor((now - start) / 1000);
            const mins = Math.floor(diff / 60).toString().padStart(2, '0');
            const secs = (diff % 60).toString().padStart(2, '0');
            const timerEl = card.querySelector('.col-tiempo');
            if (timerEl) {
                timerEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">timer</span> ${mins}:${secs}`;
                if (diff > 600) timerEl.classList.add('text-red-500', 'animate-pulse'); // 10 mins threshold
            }
        });
    }, 1000);
};

// 4. EXPORTAR CICLO DE VIDA
export const KdsController = {
    mount: async (container) => {
        _cacheDOM(container);
        _bindEvents();
        
        await fetchBoardData();
        startTimers();
        
        state.pollingInterval = setInterval(fetchBoardData, 5000);
        console.log('[KDS] Board mounted and polling started.');
    },
    unmount: () => {
        if (state.pollingInterval) clearInterval(state.pollingInterval);
        if (state.timerInterval) clearInterval(state.timerInterval);
    }
};