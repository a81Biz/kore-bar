// frontends/admin/js/views/turnos/index.js
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { HorariosController } from './horarios.js';
import { HistorialController } from './historial-nomina.js';   // ← era la línea que faltaba

// ── 2. ESTADO ────────────────────────────────────────────────
const state = {
    dom: {},
    data: {
        records: [],
        stats: { total: 0, presente: 0, esperado: 0, ausente: 0 },
        shifts: []
    },
    ui: {
        activeTab: 'monitor',
        checkinTarget: null
    }
};

const _uiConfig = {
    attendanceStatus: {
        'PRESENTE': { badge: 'bg-emerald-100 text-emerald-800', label: 'Presente' },
        'ESPERADO': { badge: 'bg-amber-100 text-amber-800', label: 'Esperando' },
        'AUSENTE': { badge: 'bg-red-100 text-red-800', label: 'Ausente' }
    },
    source: {
        'WAITERS': { badge: 'bg-emerald-100 text-emerald-700', label: 'Mesero' },
        'CASHIER': { badge: 'bg-purple-100 text-purple-700', label: 'Caja' },
        'KITCHEN': { badge: 'bg-orange-100 text-orange-700', label: 'Cocina' },
        'ADMIN': { badge: 'bg-indigo-100 text-indigo-700', label: 'Admin' }
    },
    tabs: {
        active: 'px-6 py-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 bg-white transition-colors',
        inactive: 'px-6 py-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors'
    }
};

// ── 3. CACHÉ DEL DOM ─────────────────────────────────────────
const _cacheDOM = (container) => {
    state.dom.root = container;

    state.dom.tabs = {
        monitor: container.querySelector('#tab-monitor'),
        historial: container.querySelector('#tab-historial'),
        turnos: container.querySelector('#tab-turnos'),
        seguridad: container.querySelector('#tab-seguridad'),
        horarios: container.querySelector('#tab-horarios')
    };
    state.dom.views = {
        monitor: container.querySelector('#view-monitor'),
        historial: container.querySelector('#view-historial'),
        turnos: container.querySelector('#view-turnos'),
        seguridad: container.querySelector('#view-seguridad'),
        horarios: container.querySelector('#view-horarios')
    };

    state.dom.monitorDate = container.querySelector('#monitor-date');
    state.dom.btnRefreshMonitor = container.querySelector('#btn-refresh-monitor');
    state.dom.tableMonitorBody = container.querySelector('#table-monitor-body');
    state.dom.kpiTotal = container.querySelector('#kpi-total');
    state.dom.kpiPresente = container.querySelector('#kpi-presente');
    state.dom.kpiEsperado = container.querySelector('#kpi-esperado');
    state.dom.kpiAusente = container.querySelector('#kpi-ausente');
    state.dom.tplRowMonitor = document.querySelector('#tpl-row-monitor');

    state.dom.formAdminTurno = container.querySelector('#form-admin-turno');
    state.dom.turnoCode = container.querySelector('#turno-code');
    state.dom.turnoName = container.querySelector('#turno-name');
    state.dom.turnoStart = container.querySelector('#turno-start');
    state.dom.turnoEnd = container.querySelector('#turno-end');
    state.dom.listTurnos = container.querySelector('#list-turnos');
    state.dom.tplItemTurno = document.querySelector('#tpl-item-turno');

    state.dom.formResetPin = container.querySelector('#form-reset-pin');
    state.dom.pinEmployeeNumber = container.querySelector('#pin-employee-number');
    state.dom.pinNewValue = container.querySelector('#pin-new-value');
    state.dom.pinConfirmValue = container.querySelector('#pin-confirm-value');

    // Modal check-in — se inyecta al body para que no quede dentro del scroll
    let modalCheckin = document.getElementById('modal-checkin');
    if (!modalCheckin) {
        const tpl = document.getElementById('tpl-modal-checkin');
        if (tpl) {
            document.body.appendChild(tpl.content.cloneNode(true));
            modalCheckin = document.getElementById('modal-checkin');
        }
    }
    state.dom.modalCheckin = modalCheckin;
    state.dom.checkinNombre = modalCheckin?.querySelector('#checkin-nombre');
    state.dom.checkinEmpNumber = modalCheckin?.querySelector('#checkin-employee-number');
    state.dom.checkinHora = modalCheckin?.querySelector('#checkin-hora');
    state.dom.btnConfirmCheckin = modalCheckin?.querySelector('#btn-confirm-checkin');
    state.dom.btnCancelCheckin = modalCheckin?.querySelector('#btn-cancel-checkin');
    state.dom.btnCloseCheckin = modalCheckin?.querySelector('#btn-close-checkin');

    const hoy = new Date().toISOString().split('T')[0];
    if (state.dom.monitorDate) state.dom.monitorDate.value = hoy;
};

// ── 4. RENDERIZADO ───────────────────────────────────────────
const _render = {
    switchTab: (tabKey) => {
        state.ui.activeTab = tabKey;
        Object.keys(state.dom.tabs).forEach(key => {
            const isActive = key === tabKey;
            if (state.dom.tabs[key]) {
                state.dom.tabs[key].className = isActive
                    ? _uiConfig.tabs.active
                    : _uiConfig.tabs.inactive;
            }
            if (state.dom.views[key]) {
                state.dom.views[key].classList.toggle('hidden', !isActive);
            }
        });
    },

    kpis: () => {
        const s = state.data.stats;
        if (state.dom.kpiTotal) state.dom.kpiTotal.textContent = s.total;
        if (state.dom.kpiPresente) state.dom.kpiPresente.textContent = s.presente;
        if (state.dom.kpiEsperado) state.dom.kpiEsperado.textContent = s.esperado;
        if (state.dom.kpiAusente) state.dom.kpiAusente.textContent = s.ausente;
    },

    monitorRows: (records) => {
        state.dom.tableMonitorBody.innerHTML = '';

        if (records.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 9;
            td.className = 'px-4 py-8 text-center text-slate-400 text-sm';
            td.textContent = 'No hay asignaciones para la fecha seleccionada.';
            tr.appendChild(td);
            state.dom.tableMonitorBody.appendChild(tr);
            return;
        }

        records.forEach(rec => {
            const clone = state.dom.tplRowMonitor.content.cloneNode(true);
            const nombre = `${rec.firstName || ''} ${rec.lastName || ''}`.trim();
            const yaPresente = rec.attendanceStatus === 'PRESENTE';

            clone.querySelector('.col-nombre').textContent = nombre;
            clone.querySelector('.col-employee-number').textContent = rec.employeeNumber;
            clone.querySelector('.col-shift').textContent = rec.shiftName || rec.shift;
            clone.querySelector('.col-zone').textContent = rec.zoneName || '—';
            clone.querySelector('.col-horario').textContent = rec.startTime && rec.endTime
                ? `${rec.startTime} – ${rec.endTime}` : '—';

            const statusCfg = _uiConfig.attendanceStatus[rec.attendanceStatus]
                || _uiConfig.attendanceStatus.ESPERADO;
            const badge = clone.querySelector('.col-status-badge');
            badge.textContent = statusCfg.label;
            badge.className = `col-status-badge px-2.5 py-1 text-xs font-bold rounded-full ${statusCfg.badge}`;

            clone.querySelector('.col-checkin').textContent = rec.checkInAt
                ? new Date(rec.checkInAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : '—';

            const sourceBadge = clone.querySelector('.col-source-badge');
            if (rec.source) {
                const srcCfg = _uiConfig.source[rec.source]
                    || { badge: 'bg-slate-100 text-slate-600', label: rec.source };
                sourceBadge.textContent = srcCfg.label;
                sourceBadge.className = `col-source-badge text-[10px] font-bold px-2 py-0.5 rounded uppercase ${srcCfg.badge}`;
            } else {
                sourceBadge.textContent = '—';
            }

            const btnCheckin = clone.querySelector('.btn-admin-checkin');
            if (btnCheckin) {
                btnCheckin.dataset.employeeNumber = rec.employeeNumber;
                btnCheckin.dataset.nombre = nombre;
                if (yaPresente) {
                    btnCheckin.disabled = true;
                    btnCheckin.title = 'Ya registró entrada';
                }
            }

            state.dom.tableMonitorBody.appendChild(clone);
        });
    },

    shiftsList: () => {
        if (!state.dom.listTurnos) return;
        state.dom.listTurnos.innerHTML = '';

        if (state.data.shifts.length === 0) {
            const li = document.createElement('li');
            li.className = 'px-4 py-3 text-sm text-slate-400 text-center';
            li.textContent = 'No hay turnos registrados.';
            state.dom.listTurnos.appendChild(li);
            return;
        }

        state.data.shifts.forEach(shift => {
            const clone = state.dom.tplItemTurno.content.cloneNode(true);
            clone.querySelector('.col-code').textContent = shift.code;
            clone.querySelector('.col-name').textContent = shift.name;
            clone.querySelector('.col-horario').textContent = `${shift.startTime} – ${shift.endTime}`;
            state.dom.listTurnos.appendChild(clone);
        });
    },

    checkinModal: {
        open: (employeeNumber, nombre) => {
            if (!state.dom.modalCheckin) return;
            state.ui.checkinTarget = { employeeNumber, nombre };
            const ahora = new Date();
            state.dom.checkinNombre.textContent = nombre;
            state.dom.checkinEmpNumber.textContent = `# ${employeeNumber}`;
            state.dom.checkinHora.textContent = ahora.toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            state.dom.modalCheckin.classList.remove('opacity-0', 'pointer-events-none');
            state.dom.modalCheckin.firstElementChild.classList.remove('scale-95');
        },
        close: () => {
            if (!state.dom.modalCheckin) return;
            state.ui.checkinTarget = null;
            state.dom.modalCheckin.classList.add('opacity-0', 'pointer-events-none');
            state.dom.modalCheckin.firstElementChild.classList.add('scale-95');
        }
    }
};

// ── 5. LÓGICA DE DATOS ───────────────────────────────────────
const _logic = {
    loadMonitor: async () => {
        const date = state.dom.monitorDate?.value || new Date().toISOString().split('T')[0];
        try {
            const res = await fetchData(`${ENDPOINTS.admin.get.attendance}?date=${date}`);
            state.data.records = res.data?.records || [];
            state.data.stats = res.data?.stats || { total: 0, presente: 0, esperado: 0, ausente: 0 };
            _render.kpis();
            _render.monitorRows(state.data.records);
        } catch (err) {
            showErrorModal(err.message || 'Error cargando el monitor de asistencia.');
        }
    },

    loadShifts: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.shifts);
            state.data.shifts = res.data?.shifts || [];
            _render.shiftsList();
        } catch (err) {
            showErrorModal(err.message || 'Error cargando los turnos.');
        }
    },

    createShift: async () => {
        const payload = {
            code: state.dom.turnoCode.value.trim().toUpperCase(),
            name: state.dom.turnoName.value.trim(),
            startTime: state.dom.turnoStart.value,
            endTime: state.dom.turnoEnd.value
        };
        await postData(ENDPOINTS.admin.post.shift, payload);
        showSuccessModal('Turno creado exitosamente en el catálogo.');
        await _logic.loadShifts();
    },

    resetPin: async () => {
        const employeeNumber = state.dom.pinEmployeeNumber.value.trim();
        const newPin = state.dom.pinNewValue.value;
        const confirmPin = state.dom.pinConfirmValue.value;

        if (!/^\d{4,6}$/.test(newPin)) throw new Error('El PIN debe contener entre 4 y 6 dígitos numéricos.');
        if (newPin !== confirmPin) throw new Error('Los PINs no coinciden. Vuelve a ingresarlos.');

        const confirmed = await confirmAction(
            `¿Estás seguro de restablecer el PIN del empleado ${employeeNumber}? Esta acción no se puede deshacer.`
        );
        if (!confirmed) throw new Error('Operación cancelada.');

        await putData(ENDPOINTS.admin.put.resetPin, { newPin }, { employeeNumber });
        showSuccessModal(`PIN del empleado ${employeeNumber} actualizado exitosamente.`);
    },

    adminCheckin: async () => {
        const target = state.ui.checkinTarget;
        if (!target) return;
        try {
            state.dom.btnConfirmCheckin.disabled = true;
            await postData(ENDPOINTS.admin.post.adminCheckin, {
                employeeNumber: target.employeeNumber
            });
            _render.checkinModal.close();
            showSuccessModal(`Check-in registrado para ${target.nombre}.`, 'Entrada Confirmada');
            await _logic.loadMonitor();
        } catch (err) {
            _render.checkinModal.close();
            showErrorModal(err.message || 'No se pudo registrar el check-in.');
        } finally {
            if (state.dom.btnConfirmCheckin) state.dom.btnConfirmCheckin.disabled = false;
        }
    }
};

// ── 6. EVENTOS ───────────────────────────────────────────────
const _bindEvents = () => {
    Object.keys(state.dom.tabs).forEach(tabKey => {
        if (!state.dom.tabs[tabKey]) return;
        state.dom.tabs[tabKey].addEventListener('click', async () => {
            _render.switchTab(tabKey);
            if (tabKey === 'monitor') await _logic.loadMonitor();
            if (tabKey === 'turnos') await _logic.loadShifts();
            // historial y horarios tienen sus propios controladores — no necesitan trigger aquí
        });
    });

    state.dom.btnRefreshMonitor?.addEventListener('click', _logic.loadMonitor);
    state.dom.monitorDate?.addEventListener('change', _logic.loadMonitor);

    if (state.dom.formAdminTurno) bindForm('form-admin-turno', _logic.createShift);
    if (state.dom.formResetPin) bindForm('form-reset-pin', _logic.resetPin);

    // Delegación — tabla monitor → botón check-in
    state.dom.tableMonitorBody?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-admin-checkin');
        if (btn && !btn.disabled) {
            _render.checkinModal.open(btn.dataset.employeeNumber, btn.dataset.nombre);
        }
    });

    state.dom.btnCloseCheckin?.addEventListener('click', _render.checkinModal.close);
    state.dom.btnCancelCheckin?.addEventListener('click', _render.checkinModal.close);
    state.dom.btnConfirmCheckin?.addEventListener('click', _logic.adminCheckin);
};

// ── 7. API PÚBLICA ───────────────────────────────────────────
export const TurnosController = {
    mount: async (container) => {
        _cacheDOM(container);
        _bindEvents();

        // Tab inicial: monitor en vivo
        await _logic.loadMonitor();

        // HorariosController inyecta su propio template en view-horarios
        if (state.dom.views.horarios) {
            await HorariosController.mount(state.dom.views.horarios);
        }

        // HistorialController cachea DOM del view-historial y enlaza sus propios eventos.
        // NO hace llamadas HTTP aquí — espera a que el usuario presione "Buscar".
        if (state.dom.views.historial) {
            HistorialController.mount(state.dom.views.historial);
        }
    }
};