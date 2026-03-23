// frontends/admin/js/modules/admin.horarios.controller.js
// ============================================================
// Controlador del módulo de Horarios de Personal.
// Gestiona la asignación de turnos para cajeros, cocineros y staff
// que no tienen zona física asignada (no-piso).
//
// Patrón: igual que los otros módulos Admin:
// 1. _cacheDOM  → cachea referencias al DOM del template
// 2. _bindEvents → enlaza eventos (form, buttons, filters)
// 3. logic_*     → llaman a la API y actualizan state
// 4. render_*    → pintán el DOM desde state
// ============================================================

import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { bindForm } from '/shared/js/formEngine.js';

// ── STATE ────────────────────────────────────────────────────
const state = {
    employees: [],
    shifts: [],
    schedules: [],
    stats: {}
};

// ── DOM CACHE ─────────────────────────────────────────────────
let _dom = {};

const _cacheDOM = (container) => {
    _dom = {
        empSelect: container.querySelector('#sch-employee'),
        shiftSelect: container.querySelector('#sch-shift'),
        dateInput: container.querySelector('#sch-date'),
        recurrence: container.querySelector('#sch-recurrence'),
        filterDate: container.querySelector('#sch-filter-date'),
        btnFilter: container.querySelector('#btn-sch-filter'),
        btnToday: container.querySelector('#btn-sch-today'),
        tableBody: container.querySelector('#table-horarios-body'),
        statsBar: container.querySelector('#sch-stats-bar'),
        statTotal: container.querySelector('#sch-stat-total'),
        statPresent: container.querySelector('#sch-stat-present'),
        statExpected: container.querySelector('#sch-stat-expected'),
        statAbsent: container.querySelector('#sch-stat-absent'),
    };
};

// ── LOGIC ─────────────────────────────────────────────────────

/**
 * Carga empleados y turnos en paralelo para hidratar los selects.
 * Los empleados se filtran en frontend para excluir área de Piso (code=20),
 * ya que esos tienen su roster en restaurant_assignments.
 */
const logic_loadCatalogos = async () => {
    try {
        const [empRes, shiftRes] = await Promise.all([
            fetchData(ENDPOINTS.admin.get.employees),
            fetchData(ENDPOINTS.admin.get.shifts)
        ]);

        // Excluir meseros (área Piso) del selector — ellos van en módulo de Piso
        const allEmployees = empRes.data || [];
        state.employees = allEmployees.filter(e => {
            const areaCode = e.areaCode || e.area_code || '';
            return areaCode !== '20'; // Área Piso
        });

        state.shifts = shiftRes.data?.shifts || shiftRes.data || [];

        render_empSelect();
        render_shiftSelect();

    } catch (err) {
        console.error('[HorariosController] Error cargando catálogos:', err);
        showErrorModal('No se pudieron cargar los catálogos. Verifica la conexión.');
    }
};

/**
 * Carga los horarios programados para la fecha dada y actualiza la tabla.
 * @param {string} date - Fecha en formato YYYY-MM-DD
 */
const logic_loadSchedules = async (date) => {
    if (!date) return;
    try {
        const res = await fetchData(`${ENDPOINTS.admin.get.schedules}?date=${date}`);
        state.schedules = res.data?.records || [];
        state.stats = res.data?.stats || {};
        render_table();
        render_stats();
    } catch (err) {
        console.error('[HorariosController] Error cargando horarios:', err);
        showErrorModal('Error al cargar los horarios programados.');
    }
};

/**
 * Crea un horario con recurrencia. Llamado por FormEngine al submit.
 * Lanza error si falla para que FormEngine NO limpie el formulario.
 */
const logic_createSchedule = async () => {
    const payload = {
        employeeNumber: _dom.empSelect?.value,
        shiftCode: _dom.shiftSelect?.value,
        scheduleDate: _dom.dateInput?.value,
        recurrence: _dom.recurrence?.value || 'DIA'
    };

    if (!payload.employeeNumber || !payload.shiftCode || !payload.scheduleDate) {
        showErrorModal('Completa todos los campos antes de asignar el horario.');
        throw new Error('Campos incompletos'); // FormEngine no limpia
    }

    await postData(ENDPOINTS.admin.post.schedule, payload);
    showSuccessModal('Horario asignado correctamente.');

    // Refrescar con la fecha activa del filtro (o la fecha del nuevo horario)
    const activeDate = _dom.filterDate?.value || payload.scheduleDate;
    await logic_loadSchedules(activeDate);
};

/**
 * Elimina un registro individual de horario tras confirmación.
 */
const logic_deleteSchedule = async (id, empleado, fecha) => {
    const ok = await confirmAction(`¿Eliminar el horario de ${empleado} del ${fecha}?`);
    if (!ok) return;

    try {
        await deleteData(ENDPOINTS.admin.delete.schedule, { id });
        showSuccessModal('Horario eliminado.');
        const activeDate = _dom.filterDate?.value || new Date().toISOString().split('T')[0];
        await logic_loadSchedules(activeDate);
    } catch (err) {
        showErrorModal(err.message || 'Error al eliminar el horario.');
    }
};

// ── RENDER ────────────────────────────────────────────────────

const render_empSelect = () => {
    if (!_dom.empSelect) return;
    _dom.empSelect.innerHTML = '<option value="">Seleccionar empleado...</option>';
    state.employees.forEach(emp => {
        const num = emp.employeeNumber || emp.employee_number || '';
        const nombre = `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim();
        const area = emp.areaName || emp.area_name || '';
        const opt = document.createElement('option');
        opt.value = num;
        opt.textContent = `${nombre} — ${area}`;
        _dom.empSelect.appendChild(opt);
    });
};

const render_shiftSelect = () => {
    if (!_dom.shiftSelect) return;
    _dom.shiftSelect.innerHTML = '<option value="">Seleccionar turno...</option>';
    state.shifts.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.code;
        opt.textContent = `${s.name}  (${s.startTime} – ${s.endTime})`;
        _dom.shiftSelect.appendChild(opt);
    });
};

const STATUS_BADGE = {
    PRESENTE: 'bg-emerald-100 text-emerald-700',
    ESPERADO: 'bg-amber-100  text-amber-700',
    AUSENTE: 'bg-red-100    text-red-600'
};
const STATUS_LABEL = {
    PRESENTE: 'Presente',
    ESPERADO: 'Esperado',
    AUSENTE: 'Ausente'
};

const render_table = () => {
    if (!_dom.tableBody) return;

    if (state.schedules.length === 0) {
        _dom.tableBody.innerHTML = `
            <tr>
              <td colspan="7" class="px-4 py-10 text-center text-slate-400 text-sm">
                <span class="material-symbols-outlined text-[28px] block mb-1 text-slate-300">event_busy</span>
                No hay horarios programados para esta fecha.
              </td>
            </tr>`;
        return;
    }

    _dom.tableBody.innerHTML = state.schedules.map(r => {
        const nombre = `${r.firstName} ${r.lastName}`;
        const status = r.attendanceStatus || 'ESPERADO';
        const badge = STATUS_BADGE[status] || STATUS_BADGE.ESPERADO;
        const label = STATUS_LABEL[status] || status;

        const checkIn = r.checkInAt
            ? new Date(r.checkInAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            : '—';

        const fecha = r.assignmentDate
            ? new Date(r.assignmentDate + 'T12:00:00').toLocaleDateString('es-MX', {
                weekday: 'short', day: 'numeric', month: 'short'
            })
            : '—';

        // Escapar para uso en data-* attributes
        const nombreEsc = nombre.replace(/"/g, '&quot;');
        const fechaEsc = fecha.replace(/"/g, '&quot;');

        return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-4 py-3">
            <span class="font-medium text-slate-800">${nombre}</span>
          </td>
          <td class="px-4 py-3 text-slate-600 text-xs font-medium uppercase tracking-wide">
            ${r.shiftName || r.shift || '—'}
          </td>
          <td class="px-4 py-3 text-slate-500 text-xs font-mono">
            ${r.startTime || '—'} – ${r.endTime || '—'}
          </td>
          <td class="px-4 py-3 text-slate-600">${fecha}</td>
          <td class="px-4 py-3">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}">${label}</span>
          </td>
          <td class="px-4 py-3 text-slate-500 text-xs font-mono">${checkIn}</td>
          <td class="px-4 py-3">
            <button
              class="btn-delete-schedule text-slate-400 hover:text-red-500 transition-colors"
              data-id="${r.assignmentId || r.assignment_id}"
              data-nombre="${nombreEsc}"
              data-fecha="${fechaEsc}"
              title="Eliminar horario">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </td>
        </tr>`;
    }).join('');

    // Delegar eventos de borrado en los botones recién creados
    _dom.tableBody.querySelectorAll('.btn-delete-schedule').forEach(btn => {
        btn.addEventListener('click', () => {
            logic_deleteSchedule(btn.dataset.id, btn.dataset.nombre, btn.dataset.fecha);
        });
    });
};

const render_stats = () => {
    if (!state.stats || !state.stats.total) {
        _dom.statsBar?.classList.add('hidden');
        return;
    }
    _dom.statsBar?.classList.remove('hidden');
    if (_dom.statTotal) _dom.statTotal.textContent = state.stats.total ?? 0;
    if (_dom.statPresent) _dom.statPresent.textContent = state.stats.presente ?? 0;
    if (_dom.statExpected) _dom.statExpected.textContent = state.stats.esperado ?? 0;
    if (_dom.statAbsent) _dom.statAbsent.textContent = state.stats.ausente ?? 0;
};

// ── BIND EVENTS ───────────────────────────────────────────────

const _bindEvents = () => {
    // Form submit — FormEngine maneja el reset post-éxito (UIRules define preserveFields)
    bindForm('form-employee-schedule', logic_createSchedule);

    // Filtrar por fecha personalizada
    _dom.btnFilter?.addEventListener('click', () => {
        const date = _dom.filterDate?.value;
        if (!date) return showErrorModal('Selecciona una fecha para filtrar.');
        logic_loadSchedules(date);
    });

    // Botón "Hoy" — carga horarios del día actual
    _dom.btnToday?.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        if (_dom.filterDate) _dom.filterDate.value = today;
        logic_loadSchedules(today);
    });

    // Enter en input de fecha del filtro
    _dom.filterDate?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _dom.btnFilter?.click();
    });
};

// ── MOUNT ─────────────────────────────────────────────────────

export const HorariosController = {
    async mount(container) {
        _cacheDOM(container);
        _bindEvents();

        // Establecer fecha de hoy en ambos inputs
        const today = new Date().toISOString().split('T')[0];
        if (_dom.dateInput) _dom.dateInput.value = today;
        if (_dom.filterDate) _dom.filterDate.value = today;

        // Cargar catálogos y horarios del día en paralelo
        await Promise.all([
            logic_loadCatalogos(),
            logic_loadSchedules(today)
        ]);
    }
};
