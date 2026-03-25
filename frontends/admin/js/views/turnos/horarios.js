// frontends/admin/js/views/turnos/horarios.js

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { bindForm } from '/shared/js/formEngine.js';

// ==========================================================================
// 2. ESTADO PRIVADO Y CONFIGURACIÓN
// ==========================================================================
const state = {
    employees: [],
    shifts: [],
    schedules: [],
    stats: {}
};

const _dom = {};

// Diccionario UI — cero lógica de negocio en el render
const _uiConfig = {
    status: {
        PRESENTE: { badge: 'bg-emerald-100 text-emerald-700', label: 'Presente' },
        ESPERADO: { badge: 'bg-amber-100 text-amber-700', label: 'Esperado' },
        AUSENTE: { badge: 'bg-red-100 text-red-600', label: 'Ausente' },
        DEFAULT: { badge: 'bg-amber-100 text-amber-700', label: 'Esperado' }
    }
};

// ==========================================================================
// 3. CACHÉ DEL DOM
// ==========================================================================
const _cacheDOM = (container) => {
    _dom.empSelect = container.querySelector('#sch-employee');
    _dom.shiftSelect = container.querySelector('#sch-shift');
    _dom.dateInput = container.querySelector('#sch-date');
    _dom.recurrence = container.querySelector('#sch-recurrence');
    _dom.filterDate = container.querySelector('#sch-filter-date');
    _dom.btnFilter = container.querySelector('#btn-sch-filter');
    _dom.btnToday = container.querySelector('#btn-sch-today');
    _dom.tableBody = container.querySelector('#table-horarios-body');
    _dom.statsBar = container.querySelector('#sch-stats-bar');
    _dom.statTotal = container.querySelector('#sch-stat-total');
    _dom.statPresent = container.querySelector('#sch-stat-present');
    _dom.statExpected = container.querySelector('#sch-stat-expected');
    _dom.statAbsent = container.querySelector('#sch-stat-absent');

    // Templates — busca en el documento global (los partials los inyecta TemplateLoader)
    _dom.tplRow = document.querySelector('#tpl-row-horario');
    _dom.tplEmpty = document.querySelector('#tpl-horario-empty');
};

// ==========================================================================
// 4. LÓGICA DE VISTA / RENDERIZADO
// ==========================================================================
const render = {
    empSelect: () => {
        if (!_dom.empSelect) return;
        _dom.empSelect.innerHTML = '';
        _dom.empSelect.appendChild(
            Object.assign(new Option('Seleccionar empleado...', ''), { disabled: true, selected: true })
        );
        state.employees.forEach(emp => {
            const num = emp.employeeNumber || emp.employee_number || '';
            const nombre = `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim();
            const area = emp.areaName || emp.area_name || '';
            _dom.empSelect.appendChild(new Option(`${nombre} — ${area}`, num));
        });
    },

    shiftSelect: () => {
        if (!_dom.shiftSelect) return;
        _dom.shiftSelect.innerHTML = '';
        _dom.shiftSelect.appendChild(
            Object.assign(new Option('Seleccionar turno...', ''), { disabled: true, selected: true })
        );
        state.shifts.forEach(s => {
            _dom.shiftSelect.appendChild(
                new Option(`${s.name}  (${s.startTime} – ${s.endTime})`, s.code)
            );
        });
    },

    table: () => {
        if (!_dom.tableBody) return;
        _dom.tableBody.innerHTML = '';

        if (state.schedules.length === 0) {
            const clone = _dom.tplEmpty.content.cloneNode(true);
            _dom.tableBody.appendChild(clone);
            return;
        }

        state.schedules.forEach(r => {
            const clone = _dom.tplRow.content.cloneNode(true);
            const nombre = `${r.firstName || ''} ${r.lastName || ''}`.trim();
            const status = r.attendanceStatus || 'ESPERADO';
            const cfg = _uiConfig.status[status] || _uiConfig.status.DEFAULT;

            const checkIn = r.checkInAt
                ? new Date(r.checkInAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : '—';

            const fecha = r.assignmentDate
                ? new Date(r.assignmentDate).toLocaleDateString('es-MX', {
                    weekday: 'short', day: 'numeric', month: 'short'
                })
                : '—';

            clone.querySelector('.col-nombre').textContent = nombre;
            clone.querySelector('.col-shift').textContent = r.shiftName || r.shift || '—';
            clone.querySelector('.col-horario').textContent = `${r.startTime || '—'} – ${r.endTime || '—'}`;
            clone.querySelector('.col-fecha').textContent = fecha;
            clone.querySelector('.col-checkin').textContent = checkIn;

            const badge = clone.querySelector('.col-status-badge');
            badge.textContent = cfg.label;
            badge.className = `col-status-badge px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`;

            // data-* para delegación — nunca addEventListener dentro del forEach
            const btnDel = clone.querySelector('.btn-delete-schedule');
            btnDel.dataset.id = r.assignmentId || r.assignment_id || '';
            btnDel.dataset.nombre = nombre;
            btnDel.dataset.fecha = fecha;

            _dom.tableBody.appendChild(clone);
        });
    },

    stats: () => {
        if (!state.stats?.total) {
            _dom.statsBar?.classList.add('hidden');
            return;
        }
        _dom.statsBar?.classList.remove('hidden');
        if (_dom.statTotal) _dom.statTotal.textContent = state.stats.total ?? 0;
        if (_dom.statPresent) _dom.statPresent.textContent = state.stats.presente ?? 0;
        if (_dom.statExpected) _dom.statExpected.textContent = state.stats.esperado ?? 0;
        if (_dom.statAbsent) _dom.statAbsent.textContent = state.stats.ausente ?? 0;
    }
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS
// ==========================================================================
const logic = {
    loadCatalogos: async () => {
        const [empRes, shiftRes] = await Promise.all([
            fetchData(ENDPOINTS.admin.get.employees),
            fetchData(ENDPOINTS.admin.get.shifts)
        ]);

        // Excluir área de Piso (code 20) — esos van en módulo de Piso
        state.employees = (empRes.data || []).filter(e => {
            const areaCode = String(e.areaCode || e.area_code || '');
            return areaCode !== '20';
        });
        state.shifts = shiftRes.data?.shifts || shiftRes.data || [];

        render.empSelect();
        render.shiftSelect();
    },

    loadSchedules: async (date) => {
        if (!date) return;
        const res = await fetchData(`${ENDPOINTS.admin.get.schedules}?date=${date}`);
        state.schedules = res.data?.records || [];
        state.stats = res.data?.stats || {};
        render.table();
        render.stats();
    },

    createSchedule: async () => {
        const payload = {
            employeeNumber: _dom.empSelect?.value,
            shiftCode: _dom.shiftSelect?.value,
            scheduleDate: _dom.dateInput?.value,
            recurrence: _dom.recurrence?.value || 'DIA'
        };

        if (!payload.employeeNumber || !payload.shiftCode || !payload.scheduleDate) {
            showErrorModal('Completa todos los campos antes de asignar el horario.');
            throw new Error('Campos incompletos'); // FormEngine NO limpia si lanza error
        }

        await postData(ENDPOINTS.admin.post.schedule, payload);
        showSuccessModal('Horario asignado correctamente.');
        await logic.loadSchedules(_dom.filterDate?.value || payload.scheduleDate);
    },

    deleteSchedule: async (id, nombre, fecha) => {
        const ok = await confirmAction(`¿Eliminar el horario de ${nombre} del ${fecha}?`);
        if (!ok) return;

        await deleteData(ENDPOINTS.admin.delete.schedule, { id });
        showSuccessModal('Horario eliminado.');
        await logic.loadSchedules(
            _dom.filterDate?.value || new Date().toISOString().split('T')[0]
        );
    }
};

// ==========================================================================
// 6. EVENTOS
// ==========================================================================
const _bindEvents = () => {
    bindForm('form-employee-schedule', logic.createSchedule);

    _dom.btnFilter?.addEventListener('click', () => {
        const date = _dom.filterDate?.value;
        if (!date) return showErrorModal('Selecciona una fecha para filtrar.');
        logic.loadSchedules(date);
    });

    _dom.btnToday?.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        if (_dom.filterDate) _dom.filterDate.value = today;
        logic.loadSchedules(today);
    });

    _dom.filterDate?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _dom.btnFilter?.click();
    });

    // B) DINÁMICOS — delegación al tbody padre estático
    _dom.tableBody?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-schedule');
        if (btn) logic.deleteSchedule(btn.dataset.id, btn.dataset.nombre, btn.dataset.fecha);
    });
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
export const HorariosController = {
    mount: async (container) => {
        // El container es #view-horarios dentro de _turnos.html.
        // Clonamos el template del partial _horarios.html en ese container.
        const tpl = document.getElementById('tpl-admin-horarios');
        if (tpl) container.appendChild(tpl.content.cloneNode(true));

        _cacheDOM(container);
        _bindEvents();

        const today = new Date().toISOString().split('T')[0];
        if (_dom.dateInput) _dom.dateInput.value = today;
        if (_dom.filterDate) _dom.filterDate.value = today;

        await Promise.all([
            logic.loadCatalogos(),
            logic.loadSchedules(today)
        ]);
    }
};