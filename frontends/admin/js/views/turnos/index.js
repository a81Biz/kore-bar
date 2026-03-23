// frontends/admin/js/views/turnos/index.js

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { HorariosController } from './horarios.js';

// ==========================================================================
// 2. ESTADO PRIVADO Y CONFIGURACIÓN
// ==========================================================================
const state = {
    dom: {},
    data: {
        records: [],
        stats: { total: 0, presente: 0, esperado: 0, ausente: 0 },
        shifts: []
    },
    ui: {
        activeTab: 'monitor'
    }
};

// Diccionario UI — cero lógica de negocio en el render
const _uiConfig = {
    attendanceStatus: {
        'PRESENTE': { badge: 'bg-emerald-100 text-emerald-800', label: 'Presente' },
        'ESPERADO': { badge: 'bg-amber-100 text-amber-800', label: 'Esperando' },
        'AUSENTE': { badge: 'bg-red-100 text-red-800', label: 'Ausente' }
    },
    source: {
        'WAITERS': { badge: 'bg-emerald-100 text-emerald-700', label: 'Mesero' },
        'CASHIER': { badge: 'bg-purple-100 text-purple-700', label: 'Caja' },
        'KITCHEN': { badge: 'bg-orange-100 text-orange-700', label: 'Cocina' }
    },
    tabs: {
        active: 'px-6 py-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 bg-white transition-colors',
        inactive: 'px-6 py-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors'
    }
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const _cacheDOM = (container) => {
    state.dom.root = container;

    // Tabs — incluye el 5° tab de Horarios
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

    // Monitor
    state.dom.monitorDate = container.querySelector('#monitor-date');
    state.dom.btnRefreshMonitor = container.querySelector('#btn-refresh-monitor');
    state.dom.tableMonitorBody = container.querySelector('#table-monitor-body');
    state.dom.kpiTotal = container.querySelector('#kpi-total');
    state.dom.kpiPresente = container.querySelector('#kpi-presente');
    state.dom.kpiEsperado = container.querySelector('#kpi-esperado');
    state.dom.kpiAusente = container.querySelector('#kpi-ausente');
    state.dom.tplRowMonitor = document.querySelector('#tpl-row-monitor');

    // Historial
    state.dom.histStart = container.querySelector('#hist-start');
    state.dom.histEnd = container.querySelector('#hist-end');
    state.dom.histEmployee = container.querySelector('#hist-employee');
    state.dom.btnSearchHistorial = container.querySelector('#btn-search-historial');
    state.dom.tableHistorialBody = container.querySelector('#table-historial-body');

    // Catálogo de Turnos
    state.dom.formAdminTurno = container.querySelector('#form-admin-turno');
    state.dom.turnoCode = container.querySelector('#turno-code');
    state.dom.turnoName = container.querySelector('#turno-name');
    state.dom.turnoStart = container.querySelector('#turno-start');
    state.dom.turnoEnd = container.querySelector('#turno-end');
    state.dom.listTurnos = container.querySelector('#list-turnos');
    state.dom.tplItemTurno = document.querySelector('#tpl-item-turno');

    // Reset PIN
    state.dom.formResetPin = container.querySelector('#form-reset-pin');
    state.dom.pinEmployeeNumber = container.querySelector('#pin-employee-number');
    state.dom.pinNewValue = container.querySelector('#pin-new-value');
    state.dom.pinConfirmValue = container.querySelector('#pin-confirm-value');

    // Fecha inicial del monitor
    const hoy = new Date().toISOString().split('T')[0];
    if (state.dom.monitorDate) state.dom.monitorDate.value = hoy;
};

// ==========================================================================
// 4. RENDERIZADO
// ==========================================================================
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
            td.colSpan = 8;
            td.className = 'px-4 py-8 text-center text-slate-400 text-sm';
            td.textContent = 'No hay asignaciones para la fecha seleccionada.';
            tr.appendChild(td);
            state.dom.tableMonitorBody.appendChild(tr);
            return;
        }

        records.forEach(rec => {
            const clone = state.dom.tplRowMonitor.content.cloneNode(true);
            const nombre = `${rec.firstName || ''} ${rec.lastName || ''}`.trim();

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
                const srcCfg = _uiConfig.source[rec.source] || { badge: 'bg-slate-100 text-slate-600', label: rec.source };
                sourceBadge.textContent = srcCfg.label;
                sourceBadge.className = `col-source-badge text-[10px] font-bold px-2 py-0.5 rounded uppercase ${srcCfg.badge}`;
            } else {
                sourceBadge.textContent = '—';
            }

            state.dom.tableMonitorBody.appendChild(clone);
        });
    },

    historialRows: (records) => {
        state.dom.tableHistorialBody.innerHTML = '';

        if (records.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.className = 'px-4 py-8 text-center text-slate-400 text-sm';
            td.textContent = 'No se encontraron registros para el rango indicado.';
            tr.appendChild(td);
            state.dom.tableHistorialBody.appendChild(tr);
            return;
        }

        records.forEach(rec => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-sm';
            const nombre = `${rec.firstName || ''} ${rec.lastName || ''}`.trim();
            const statusCfg = _uiConfig.attendanceStatus[rec.attendanceStatus]
                || _uiConfig.attendanceStatus.ESPERADO;
            const srcCfg = rec.source
                ? (_uiConfig.source[rec.source] || { badge: 'bg-slate-100 text-slate-600', label: rec.source })
                : null;

            [
                { text: rec.assignmentDate, cls: 'px-4 py-3 text-slate-500' },
                { text: `${nombre} (${rec.employeeNumber})`, cls: 'px-4 py-3 font-medium text-slate-800' },
                { text: rec.shiftName || rec.shift, cls: 'px-4 py-3 text-slate-600' },
                { text: rec.zoneName || '—', cls: 'px-4 py-3 text-slate-600' }
            ].forEach(({ text, cls }) => {
                const td = document.createElement('td');
                td.className = cls;
                td.textContent = text || '—';
                tr.appendChild(td);
            });

            const tdStatus = document.createElement('td');
            tdStatus.className = 'px-4 py-3 text-center';
            const badgeEl = document.createElement('span');
            badgeEl.className = `px-2.5 py-1 text-xs font-bold rounded-full ${statusCfg.badge}`;
            badgeEl.textContent = statusCfg.label;
            tdStatus.appendChild(badgeEl);
            tr.appendChild(tdStatus);

            const tdCheckin = document.createElement('td');
            tdCheckin.className = 'px-4 py-3 text-xs text-slate-500';
            tdCheckin.textContent = rec.checkInAt
                ? new Date(rec.checkInAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : '—';
            tr.appendChild(tdCheckin);

            const tdSource = document.createElement('td');
            tdSource.className = 'px-4 py-3';
            if (srcCfg) {
                const srcBadge = document.createElement('span');
                srcBadge.className = `text-[10px] font-bold px-2 py-0.5 rounded uppercase ${srcCfg.badge}`;
                srcBadge.textContent = srcCfg.label;
                tdSource.appendChild(srcBadge);
            } else {
                tdSource.textContent = '—';
            }
            tr.appendChild(tdSource);

            state.dom.tableHistorialBody.appendChild(tr);
        });
    },

    shiftsList: () => {
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
    }
};

// ==========================================================================
// 5. LÓGICA DE DATOS
// ==========================================================================
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

    loadHistorial: async () => {
        const startDate = state.dom.histStart?.value;
        const endDate = state.dom.histEnd?.value;
        const employeeNumber = state.dom.histEmployee?.value?.trim();

        if (!startDate || !endDate) {
            showErrorModal('Selecciona un rango de fechas completo (Desde y Hasta).');
            return;
        }

        let url = `${ENDPOINTS.admin.get.attendance}?startDate=${startDate}&endDate=${endDate}`;
        if (employeeNumber) url += `&employeeNumber=${encodeURIComponent(employeeNumber)}`;

        try {
            const res = await fetchData(url);
            _render.historialRows(res.data?.records || []);
        } catch (err) {
            showErrorModal(err.message || 'Error cargando el historial.');
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

        if (!/^\d{4,6}$/.test(newPin)) {
            throw new Error('El PIN debe contener entre 4 y 6 dígitos numéricos.');
        }
        if (newPin !== confirmPin) {
            throw new Error('Los PINs no coinciden. Vuelve a ingresarlos.');
        }

        const confirmed = await confirmAction(
            `¿Estás seguro de restablecer el PIN del empleado ${employeeNumber}? Esta acción no se puede deshacer.`
        );
        if (!confirmed) throw new Error('Operación cancelada.');

        await putData(ENDPOINTS.admin.put.resetPin, { newPin }, { employeeNumber });
        showSuccessModal(`PIN del empleado ${employeeNumber} actualizado exitosamente.`);
    }
};

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
const _bindEvents = () => {
    // Tabs — con lazy loading donde aplica
    Object.keys(state.dom.tabs).forEach(tabKey => {
        if (!state.dom.tabs[tabKey]) return;
        state.dom.tabs[tabKey].addEventListener('click', async () => {
            _render.switchTab(tabKey);
            if (tabKey === 'monitor' && state.data.records.length === 0) {
                await _logic.loadMonitor();
            }
            if (tabKey === 'turnos' && state.data.shifts.length === 0) {
                await _logic.loadShifts();
            }
            // 'horarios' ya se cargó en el mount — no requiere lazy loading
        });
    });

    // Monitor
    state.dom.btnRefreshMonitor?.addEventListener('click', _logic.loadMonitor);
    state.dom.monitorDate?.addEventListener('change', _logic.loadMonitor);

    // Historial
    state.dom.btnSearchHistorial?.addEventListener('click', _logic.loadHistorial);

    // Catálogo de Turnos
    if (state.dom.formAdminTurno) bindForm('form-admin-turno', _logic.createShift);

    // Reset PIN
    if (state.dom.formResetPin) bindForm('form-reset-pin', _logic.resetPin);
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const TurnosController = {
    mount: async (container) => {
        _cacheDOM(container);
        _bindEvents();

        // Monitor es la tab por defecto
        await _logic.loadMonitor();

        // Montar HorariosController en su contenedor (#view-horarios).
        // NO se usa viewManager.mount aquí — eso destruiría la vista de Turnos.
        // HorariosController clona internamente tpl-admin-horarios en ese div.
        if (state.dom.views.horarios) {
            await HorariosController.mount(state.dom.views.horarios);
        }
    }
};