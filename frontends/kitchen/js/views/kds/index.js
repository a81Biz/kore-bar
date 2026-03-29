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
    try {
        const { supabaseUrl, supabaseAnonKey } = await waitForEnv();
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        state.channel = supabase
            .channel('kds-order-items')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },
                () => fetchBoardData())
            .subscribe();
    } catch (e) {
        // Supabase no configurado — polling de 5s como fallback
        console.warn('[KDS] Supabase no disponible, usando polling:', e.message);
        state.pollingInterval = setInterval(fetchBoardData, 5000);
    }
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
            const board = res.data.board;
            if (Array.isArray(board)) {
                // API devuelve array plano
                state.items = board;
            } else if (board && typeof board === 'object') {
                // API devuelve { pending: [], preparing: [], ready: [] } — normalizar
                state.items = [
                    ...(board.pending || []),
                    ...(board.preparing || []),
                    ...(board.ready || [])
                ];
            } else {
                state.items = [];
            }
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

    // FIX: El código anterior hacía:
    //   if (state.items.pending.length < 1 || state.items.preparing.length < 1 || ...)
    // state.items es un array plano → .pending es undefined → crash.
    // Además el || hacía que saliera cuando CUALQUIER columna estaba vacía (siempre al inicio).
    if (!state.items || state.items.length === 0) {
        state.dom.countPending.textContent = '0';
        state.dom.countPreparing.textContent = '0';
        state.dom.countReady.textContent = '0';
        return;
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

    Object.entries(colMap).forEach(([status, col]) => {
        groups[status].forEach(item => col.appendChild(createOrderCard(item)));
    });
};

const createOrderCard = (item) => {
    const template = document.getElementById('tpl-kds-order-card');
    const card = template.content.cloneNode(true);
    const root = card.querySelector('div');

    root.querySelector('.col-mesa').textContent = `Mesa ${item.table_code || '--'}`;
    root.querySelector('.col-ticket').textContent = `#${item.order_code}`;
    root.querySelector('.col-mesero').textContent = item.waiter_name || 'Personal';

    const startTime = new Date(item.started_at || item.created_at).getTime();
    root.setAttribute('data-start-time', startTime);
    root.classList.add('kds-card');

    const itemsContainer = root.querySelector('.col-items');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex justify-between items-center text-white font-bold';
    const itemSpan = document.createElement('span');
    itemSpan.textContent = `${item.quantity}x ${item.name}`;
    itemDiv.appendChild(itemSpan);
    itemsContainer.appendChild(itemDiv);

    if (item.notes) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'text-xs text-slate-400 italic mt-1';
        notesDiv.textContent = item.notes;
        itemsContainer.appendChild(notesDiv);
    }

    const actionsContainer = root.querySelector('.col-actions');

    if (item.status === 'PENDING_KITCHEN') {
        const btn = document.createElement('button');
        btn.className = 'flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 rounded-lg transition-colors uppercase text-sm tracking-widest';
        btn.textContent = 'COMENZAR';
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

// ── 5. CICLO DE VIDA PÚBLICO ─────────────────────────────────────────────
export const KdsController = {
    mount: async (container) => {
        _cacheDOM(container);
        _bindEvents();
        await fetchBoardData();
        await startRealtime();
        startTimers();
    },
    unmount: () => {
        state.channel?.unsubscribe();
        if (state.timerInterval) clearInterval(state.timerInterval);
        if (state.pollingInterval) clearInterval(state.pollingInterval);
    }
};