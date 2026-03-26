// frontends/kitchen/js/views/kds/index.js
import { PubSub } from '/shared/js/pubsub.js';
import { fetchData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showErrorModal } from '/shared/js/ui.js';
import { waitForEnv } from '/core/js/kore.env.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';



// ── 1. ESTADO PRIVADO ─────────────────────────────────────────────────────
const state = {
    dom: {},
    items: [],
    pollingInterval: null,
    timerInterval: null
};

// ── 2. CACHÉ DE DOM ───────────────────────────────────────────────────────
const _cacheDOM = (container) => {
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

const startRealtime = async () => {
    const { supabaseUrl, supabaseAnonKey } = await waitForEnv();
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    state.channel = supabase
        .channel('kds-order-items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },
            () => fetchBoardData())
        .subscribe();
};

const _bindEvents = () => {
    state.dom.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-nav');
            if (targetView) PubSub.publish('NAVIGATE', targetView);
        });
    });

    state.dom.btnClockIn?.addEventListener('click', () => {
        PubSub.publish('OPEN_MODAL', 'pin-modal');
    });
};

// ── 3. LÓGICA DEL TABLERO ────────────────────────────────────────────────
const fetchBoardData = async () => {
    try {
        const res = await fetchData(ENDPOINTS.kitchen.get.board);
        if (res.success) {
            state.items = res.data.board || [];
            renderBoard();
        }
    } catch (e) {
        console.error('[KDS] Error fetching board', e);
    }
};

const renderBoard = () => {
    state.dom.colPending.innerHTML = '';
    state.dom.colPreparing.innerHTML = '';
    state.dom.colReady.innerHTML = '';

    const groups = {
        PENDING_KITCHEN: [],
        PREPARING: [],
        READY: []
    };

    if (state.items.pending.length < 1 || state.items.preparing.length < 1 || state.items.ready.length < 1) {
        return
    }

    state.items.forEach(item => {
        if (groups[item.status]) groups[item.status].push(item);
    });

    state.dom.countPending.textContent = groups.PENDING_KITCHEN.length;
    state.dom.countPreparing.textContent = groups.PREPARING.length;
    state.dom.countReady.textContent = groups.READY.length;

    const colMap = {
        PENDING_KITCHEN: state.dom.colPending,
        PREPARING: state.dom.colPreparing,
        READY: state.dom.colReady
    };

    Object.entries(colMap).forEach(([status, container]) => {
        groups[status].forEach(item => container.appendChild(createOrderCard(item)));
    });
};

const createOrderCard = (item) => {
    const template = document.getElementById('tpl-kds-order-card');
    const card = template.content.cloneNode(true);
    const root = card.querySelector('div');

    // ✅ textContent para todos los campos que vienen de la API
    root.querySelector('.col-mesa').textContent = `Mesa ${item.table_code || '--'}`;
    root.querySelector('.col-ticket').textContent = `#${item.order_code}`;
    root.querySelector('.col-mesero').textContent = item.waiter_name || 'Personal';

    // Timer
    const startTime = new Date(item.started_at || item.created_at).getTime();
    root.setAttribute('data-start-time', startTime);
    root.classList.add('kds-card');

    // ✅ Items del pedido — textContent, sin innerHTML con template literals
    const itemsContainer = root.querySelector('.col-items');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex justify-between items-center text-white font-bold';
    const itemSpan = document.createElement('span');
    itemSpan.textContent = `${item.quantity}x ${item.name}`;
    itemDiv.appendChild(itemSpan);
    itemsContainer.appendChild(itemDiv);

    // Acciones por estado
    const actionsContainer = root.querySelector('.col-actions');

    if (item.status === 'PENDING_KITCHEN') {
        const btn = document.createElement('button');
        btn.className = 'flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 rounded-lg transition-colors uppercase text-sm tracking-widest';
        btn.textContent = 'COMENZAR';
        // ✅ addEventListener en lugar de onclick
        btn.addEventListener('click', () => updateItemStatus(item.id, 'PREPARING'));
        actionsContainer.appendChild(btn);

    } else if (item.status === 'PREPARING') {
        root.classList.replace('border-amber-500', 'border-orange-500');
        const btn = document.createElement('button');
        btn.className = 'flex-1 bg-orange-500 hover:bg-orange-400 text-white font-black py-3 rounded-lg transition-colors uppercase text-sm tracking-widest';
        btn.textContent = 'LISTO';
        btn.addEventListener('click', () => updateItemStatus(item.id, 'READY'));
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
        if (res.success) await fetchBoardData();
    } catch (e) {
        // ✅ showErrorModal en lugar de alert()
        showErrorModal('Error al actualizar estado: ' + e.message, 'Error KDS');
    }
};

// ── 4. TIMERS ─────────────────────────────────────────────────────────────
const startTimers = () => {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        document.querySelectorAll('.kds-card').forEach(card => {
            const start = parseInt(card.getAttribute('data-start-time'));
            const diff = Math.floor((Date.now() - start) / 1000);
            const mins = Math.floor(diff / 60).toString().padStart(2, '0');
            const secs = (diff % 60).toString().padStart(2, '0');
            const timerEl = card.querySelector('.col-tiempo');
            if (!timerEl) return;

            // ✅ Construir el timer con DOM — sin innerHTML
            timerEl.textContent = '';
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-symbols-outlined text-[14px]';
            iconSpan.textContent = 'timer';
            timerEl.appendChild(iconSpan);
            timerEl.appendChild(document.createTextNode(` ${mins}:${secs}`));

            if (diff > 600) timerEl.classList.add('text-red-500', 'animate-pulse');
        });
    }, 1000);
};

// ── 5. CICLO DE VIDA PÚBLICO ──────────────────────────────────────────────
export const KdsController = {
    mount: async (container) => {
        _cacheDOM(container);
        _bindEvents();
        await fetchBoardData();
        await startRealtime();
        startTimers();
        //state.pollingInterval = setInterval(fetchBoardData, 5000);
    },
    unmount: () => {
        // if (state.pollingInterval) clearInterval(state.pollingInterval);
        // if (state.timerInterval) clearInterval(state.timerInterval);
        state.channel?.unsubscribe();
        if (state.timerInterval) clearInterval(state.timerInterval);

    }
};
