// frontends/admin/js/views/turnos/historial-nomina.js
//
// Controlador del tab "Historial" en el módulo Turnos.
// Reemplaza la lógica de historial que vivía inline en turnos/index.js.
// Exportar HistorialController y llamar desde TurnosController.mount().
//
// Dependencias nuevas en endpoints.js:
//   admin.get.payrollHistory   → '/admin/attendance/payroll'
//   admin.get.payrollExport    → '/admin/attendance/payroll/export'
//   admin.post.deduction       → '/admin/attendance/deductions'
//   admin.delete.deduction     → '/admin/attendance/deductions/:id'

import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';

// ── ESTADO ────────────────────────────────────────────────────
const state = {
    dom:  {},
    data: {
        employees: [],
        summary:   null,
        lastQuery: { startDate: null, endDate: null }
    },
    ui: {
        deductionTarget: null   // { employeeNumber, nombre, workDate, shiftName }
    }
};

// Nota informativa por tipo de descuento
const DEDUCTION_NOTES = {
    FALTA_INJUSTIFICADA: { cls: 'bg-red-50 border-red-100 text-red-700',     text: '⚠️ Este tipo cancela el pago del día completo.' },
    RETARDO:             { cls: 'bg-amber-50 border-amber-100 text-amber-700',text: '⏱️ El día se paga pero queda registrado para RRHH.' },
    PERMISO_SIN_GOCE:    { cls: 'bg-orange-50 border-orange-100 text-orange-700', text: '📋 Permiso autorizado sin pago. Cancela el día.' },
    DIA_ECONOMICO:       { cls: 'bg-blue-50 border-blue-100 text-blue-700',   text: '📅 Día libre acordado. Se descuenta de nómina.' },
    SUSPENSION:          { cls: 'bg-red-50 border-red-100 text-red-700',      text: '🚫 Suspensión disciplinaria. Cancela el día.' },
    SANCION:             { cls: 'bg-purple-50 border-purple-100 text-purple-700', text: '💰 Sanción económica. El día se paga con penalización.' }
};

const DAY_STATUS = {
    worked_paid:   { badge: 'bg-emerald-100 text-emerald-700', label: 'Pagado' },
    worked_deduc:  { badge: 'bg-orange-100 text-orange-700',   label: 'Descuento' },
    absent:        { badge: 'bg-red-100 text-red-600',         label: 'Ausente' },
    pending:       { badge: 'bg-slate-100 text-slate-500',     label: 'Sin registro' }
};

// ── CACHÉ DOM ─────────────────────────────────────────────────
const _cacheDOM = (container) => {
    state.dom.histStart         = container.querySelector('#hist-start');
    state.dom.histEnd           = container.querySelector('#hist-end');
    state.dom.histEmployee      = container.querySelector('#hist-employee');
    state.dom.btnSearch         = container.querySelector('#btn-search-historial');

    state.dom.summary           = container.querySelector('#hist-summary');
    state.dom.kpiEmployees      = container.querySelector('#hist-kpi-employees');
    state.dom.kpiTotal          = container.querySelector('#hist-kpi-total');
    state.dom.kpiWorked         = container.querySelector('#hist-kpi-worked');
    state.dom.kpiPayable        = container.querySelector('#hist-kpi-payable');
    state.dom.kpiDeductions     = container.querySelector('#hist-kpi-deductions');

    state.dom.employeesList     = container.querySelector('#hist-employees-list');

    state.dom.exportPanel       = container.querySelector('#hist-export-panel');
    state.dom.btnDownloadCSV    = container.querySelector('#btn-download-csv');
    state.dom.inputRrhhUrl      = container.querySelector('#input-rrhh-url');
    state.dom.btnSendRrhh       = container.querySelector('#btn-send-rrhh');

    state.dom.tplCard           = document.querySelector('#tpl-hist-employee-card');
    state.dom.tplRow            = document.querySelector('#tpl-hist-day-row');

    // Modales — se inyectan al body
    _initModal('tpl-modal-deduction', 'modal-deduction');
};

const _initModal = (tplId, modalId) => {
    if (!document.getElementById(modalId)) {
        const tpl = document.getElementById(tplId);
        if (tpl) document.body.appendChild(tpl.content.cloneNode(true));
    }
    state.dom.modalDeduction      = document.getElementById('modal-deduction');
    state.dom.deductionEmpNombre  = document.getElementById('deduction-emp-nombre');
    state.dom.deductionWorkDate   = document.getElementById('deduction-work-date');
    state.dom.selectDeductionType = document.getElementById('select-deduction-type');
    state.dom.inputMotivo         = document.getElementById('input-deduction-motivo');
    state.dom.deductionTypeNote   = document.getElementById('deduction-type-note');
    state.dom.btnCloseDeduction   = document.getElementById('btn-close-deduction');
    state.dom.btnCancelDeduction  = document.getElementById('btn-cancel-deduction');
    state.dom.btnConfirmDeduction = document.getElementById('btn-confirm-deduction');
};

// ── RENDERIZADO ───────────────────────────────────────────────
const render = {
    kpis: (summary) => {
        if (!summary) return;
        state.dom.summary.classList.remove('hidden');
        state.dom.kpiEmployees.textContent  = summary.totalEmployees;
        state.dom.kpiTotal.textContent      = summary.totals.totalDays;
        state.dom.kpiWorked.textContent     = summary.totals.daysWorked;
        state.dom.kpiPayable.textContent    = summary.totals.payableDays;
        state.dom.kpiDeductions.textContent = summary.totals.deductions;
    },

    employees: (employees) => {
        state.dom.employeesList.innerHTML = '';

        if (!employees || employees.length === 0) {
            state.dom.employeesList.innerHTML =
                '<div class="p-8 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">No se encontraron registros para el período seleccionado.</div>';
            state.dom.exportPanel.classList.add('hidden');
            return;
        }

        employees.forEach(emp => {
            const clone = state.dom.tplCard.content.cloneNode(true);
            const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
            const nombre   = `${emp.firstName} ${emp.lastName}`.trim();

            clone.querySelector('.col-emp-initials').textContent  = initials;
            clone.querySelector('.col-emp-nombre').textContent    = nombre;
            clone.querySelector('.col-emp-number').textContent    = emp.employeeNumber;
            clone.querySelector('.col-emp-area').textContent      = emp.areaName;
            clone.querySelector('.col-emp-total').textContent     = emp.summary.totalDays;
            clone.querySelector('.col-emp-worked').textContent    = emp.summary.daysWorked;
            clone.querySelector('.col-emp-payable').textContent   = emp.summary.payableDays;
            clone.querySelector('.col-emp-deductions').textContent = emp.summary.deductions;

            // Colorear conteo de descuentos si > 0
            if (emp.summary.deductions > 0) {
                clone.querySelector('.col-emp-deductions').classList.add('text-red-500');
            }

            // Renderizar días
            const tbody = clone.querySelector('.hist-days-body');
            emp.days.forEach(day => {
                const row = render.dayRow(day, emp, nombre);
                tbody.appendChild(row);
            });

            state.dom.employeesList.appendChild(clone);
        });

        // Mostrar panel de exportación
        state.dom.exportPanel.classList.remove('hidden');

        // Bind toggles de acordeón
        state.dom.employeesList.querySelectorAll('.hist-card-toggle').forEach(header => {
            header.addEventListener('click', () => {
                const container = header.closest('.bg-white').querySelector('.hist-days-container');
                const chevron   = header.querySelector('.hist-chevron');
                const isOpen    = !container.classList.contains('hidden');
                container.classList.toggle('hidden', isOpen);
                chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        });
    },

    dayRow: (day, emp, nombreEmpleado) => {
        const tplClone = state.dom.tplRow.content.cloneNode(true);
        const tr = tplClone.querySelector('tr');

        // Determinar estado del día
        let statusKey;
        if (!day.workedDay && !day.hasDeduction)         statusKey = 'absent';
        else if (!day.workedDay && day.hasDeduction)     statusKey = 'absent';
        else if (day.workedDay && day.hasDeduction)      statusKey = 'worked_deduc';
        else if (day.workedDay)                          statusKey = 'worked_paid';
        else                                             statusKey = 'pending';

        const statusCfg = DAY_STATUS[statusKey];

        // Fecha
        tplClone.querySelector('.col-day-date').textContent =
            new Date(day.workDate + 'T12:00:00').toLocaleDateString('es-MX', {
                weekday: 'short', day: 'numeric', month: 'short'
            });

        // Turno y horario
        tplClone.querySelector('.col-day-shift').textContent   = day.shiftName || '—';
        tplClone.querySelector('.col-day-horario').textContent =
            day.startTime && day.endTime ? `${day.startTime} – ${day.endTime}` : '';

        // Check-in
        const checkinEl = tplClone.querySelector('.col-day-checkin');
        if (day.checkInAt) {
            checkinEl.textContent = new Date(day.checkInAt).toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            checkinEl.className = 'col-day-checkin text-xs font-mono text-emerald-600 font-bold';
        } else {
            checkinEl.textContent = '—';
        }

        // Badge estado
        const badge = tplClone.querySelector('.col-day-status-badge');
        badge.textContent = statusCfg.label;
        badge.className   = `col-day-status-badge px-2 py-0.5 text-[10px] font-bold rounded-full ${statusCfg.badge}`;

        // Descuento
        if (day.hasDeduction) {
            tplClone.querySelector('.col-day-deduction-info').classList.remove('hidden');
            tplClone.querySelector('.col-day-no-deduction').classList.add('hidden');
            tplClone.querySelector('.col-day-deduction-type').textContent = day.deductionType.replace(/_/g, ' ');
            tplClone.querySelector('.col-day-motivo').textContent         = day.motivo;

            // Botón quitar descuento
            const btnDel = tplClone.querySelector('.btn-del-deduction');
            btnDel.classList.remove('hidden');
            btnDel.dataset.deductionId = day.deductionId;
            tplClone.querySelector('.btn-add-deduction').classList.add('hidden');
        } else {
            // Botón agregar descuento
            const btnAdd = tplClone.querySelector('.btn-add-deduction');
            btnAdd.dataset.employeeNumber = emp.employeeNumber;
            btnAdd.dataset.workDate       = day.workDate;
            btnAdd.dataset.shiftName      = day.shiftName || '';
            btnAdd.dataset.nombre         = nombreEmpleado;
        }

        return tplClone;
    },

    // Modal de descuento
    deductionModal: {
        open: (employeeNumber, nombre, workDate, shiftName) => {
            if (!state.dom.modalDeduction) return;
            state.ui.deductionTarget = { employeeNumber, nombre, workDate, shiftName };

            state.dom.deductionEmpNombre.textContent = nombre;
            state.dom.deductionWorkDate.textContent  =
                `${new Date(workDate + 'T12:00:00').toLocaleDateString('es-MX', {
                    weekday: 'long', day: 'numeric', month: 'long'
                })} — ${shiftName || 'Sin turno'}`;

            state.dom.selectDeductionType.value = '';
            state.dom.inputMotivo.value          = '';
            state.dom.deductionTypeNote.classList.add('hidden');

            state.dom.modalDeduction.classList.remove('opacity-0', 'pointer-events-none');
            state.dom.modalDeduction.firstElementChild.classList.remove('scale-95');
        },
        close: () => {
            if (!state.dom.modalDeduction) return;
            state.ui.deductionTarget = null;
            state.dom.modalDeduction.classList.add('opacity-0', 'pointer-events-none');
            state.dom.modalDeduction.firstElementChild.classList.add('scale-95');
        }
    }
};

// ── LÓGICA ────────────────────────────────────────────────────
const logic = {
    search: async () => {
        const startDate      = state.dom.histStart?.value;
        const endDate        = state.dom.histEnd?.value;
        const employeeNumber = state.dom.histEmployee?.value?.trim();

        if (!startDate || !endDate) {
            showErrorModal('Selecciona un rango de fechas completo (Desde y Hasta).');
            return;
        }

        state.data.lastQuery = { startDate, endDate, employeeNumber };

        try {
            let url = `${ENDPOINTS.admin.get.payrollHistory}?startDate=${startDate}&endDate=${endDate}`;
            if (employeeNumber) url += `&employeeNumber=${encodeURIComponent(employeeNumber)}`;

            const res = await fetchData(url);
            state.data.employees = res.data?.employees || [];
            state.data.summary   = res.data?.summary   || null;

            render.kpis(state.data.summary);
            render.employees(state.data.employees);
        } catch (err) {
            showErrorModal(err.message || 'Error cargando el historial de nómina.');
        }
    },

    createDeduction: async () => {
        const target        = state.ui.deductionTarget;
        const deductionType = state.dom.selectDeductionType.value;
        const motivo        = state.dom.inputMotivo.value.trim();

        if (!target || !deductionType) {
            showErrorModal('Selecciona un tipo de descuento.');
            return;
        }
        if (!motivo) {
            showErrorModal('El motivo es obligatorio para el expediente.');
            return;
        }

        try {
            state.dom.btnConfirmDeduction.disabled = true;
            await postData(ENDPOINTS.admin.post.deduction, {
                employeeNumber: target.employeeNumber,
                deductionDate:  target.workDate,
                deductionType,
                motivo
            });
            render.deductionModal.close();
            showSuccessModal(`Descuento aplicado para ${target.nombre}.`, 'Descuento Registrado');
            await logic.search(); // Refrescar
        } catch (err) {
            showErrorModal(err.message || 'Error aplicando el descuento.');
        } finally {
            if (state.dom.btnConfirmDeduction) state.dom.btnConfirmDeduction.disabled = false;
        }
    },

    deleteDeduction: async (deductionId) => {
        const ok = await confirmAction('¿Quitar este descuento? El expediente se actualizará.');
        if (!ok) return;

        try {
            const url = ENDPOINTS.admin.delete.deduction.replace(':id', deductionId);
            await deleteData(url);
            showSuccessModal('Descuento eliminado.', 'Descuento Quitado');
            await logic.search();
        } catch (err) {
            showErrorModal(err.message || 'Error eliminando el descuento.');
        }
    },

    downloadCSV: async () => {
        const { startDate, endDate } = state.data.lastQuery;
        if (!startDate || !endDate) {
            showErrorModal('Primero realiza una búsqueda para poder exportar.');
            return;
        }

        try {
            const res = await fetchData(
                `${ENDPOINTS.admin.get.payrollExport}?startDate=${startDate}&endDate=${endDate}`
            );
            const rows = res.data?.rows || [];
            if (rows.length === 0) {
                showErrorModal('No hay datos para exportar en el período indicado.');
                return;
            }

            const headers = [
                'Num. Empleado', 'Nombre', 'Apellido', 'Área', 'Puesto',
                'Días Asignados', 'Días Laborados', 'Días a Pagar', 'Total Descuentos',
                'Faltas', 'Retardos', 'Permiso sin Goce', 'Día Económico', 'Suspensión', 'Sanción'
            ];

            const csvRows = rows.map(r => [
                r.employeeNumber, r.firstName, r.lastName, r.areaName, r.jobTitle,
                r.totalDays, r.daysWorked, r.payableDays, r.deductions,
                r.deductFalta, r.deductRetardo, r.deductPermiso,
                r.deductEconomico, r.deductSuspension, r.deductSancion
            ].join(','));

            const BOM = '\uFEFF';
            const csv = BOM + [headers.join(','), ...csvRows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href     = url;
            link.download = `nomina_${startDate}_${endDate}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            showErrorModal(err.message || 'Error generando el CSV.');
        }
    },

    sendToRrhh: async () => {
        const rrhhUrl = state.dom.inputRrhhUrl.value.trim();
        if (!rrhhUrl) {
            showErrorModal('Ingresa la URL del sistema RRHH.');
            return;
        }

        const { startDate, endDate } = state.data.lastQuery;
        if (!startDate || !endDate) {
            showErrorModal('Primero realiza una búsqueda para poder exportar.');
            return;
        }

        try {
            state.dom.btnSendRrhh.disabled    = true;
            state.dom.btnSendRrhh.textContent = 'Enviando...';

            const res = await fetchData(
                `${ENDPOINTS.admin.get.payrollExport}?startDate=${startDate}&endDate=${endDate}`
            );

            // POST directo a la URL de RRHH (proxy externo)
            const response = await fetch(rrhhUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(res.data)
            });

            if (!response.ok) throw new Error(`El servidor RRHH respondió con ${response.status}`);

            showSuccessModal('Datos de nómina enviados correctamente al sistema RRHH.', 'Envío Exitoso');
        } catch (err) {
            showErrorModal(err.message || 'No se pudo conectar con el sistema RRHH.');
        } finally {
            state.dom.btnSendRrhh.disabled    = false;
            state.dom.btnSendRrhh.textContent = 'Enviar';
        }
    }
};

// ── EVENTOS ───────────────────────────────────────────────────
const _bindEvents = (container) => {
    state.dom.btnSearch?.addEventListener('click', logic.search);
    state.dom.histStart?.addEventListener('keydown', e => { if (e.key === 'Enter') logic.search(); });
    state.dom.histEnd?.addEventListener('keydown',   e => { if (e.key === 'Enter') logic.search(); });

    // Delegación en la lista de empleados
    state.dom.employeesList?.addEventListener('click', (e) => {
        const btnAdd = e.target.closest('.btn-add-deduction');
        if (btnAdd) {
            render.deductionModal.open(
                btnAdd.dataset.employeeNumber,
                btnAdd.dataset.nombre,
                btnAdd.dataset.workDate,
                btnAdd.dataset.shiftName
            );
            return;
        }

        const btnDel = e.target.closest('.btn-del-deduction');
        if (btnDel) {
            logic.deleteDeduction(btnDel.dataset.deductionId);
        }
    });

    // Modal descuento
    state.dom.btnCloseDeduction?.addEventListener('click',  render.deductionModal.close);
    state.dom.btnCancelDeduction?.addEventListener('click', render.deductionModal.close);
    state.dom.btnConfirmDeduction?.addEventListener('click', logic.createDeduction);

    // Nota informativa por tipo
    state.dom.selectDeductionType?.addEventListener('change', (e) => {
        const note = DEDUCTION_NOTES[e.target.value];
        if (note) {
            state.dom.deductionTypeNote.className    = `text-xs p-3 rounded-lg border ${note.cls}`;
            state.dom.deductionTypeNote.textContent  = note.text;
            state.dom.deductionTypeNote.classList.remove('hidden');
        } else {
            state.dom.deductionTypeNote.classList.add('hidden');
        }
    });

    // Exportación
    state.dom.btnDownloadCSV?.addEventListener('click', logic.downloadCSV);
    state.dom.btnSendRrhh?.addEventListener('click', logic.sendToRrhh);
};

// ── API PÚBLICA ───────────────────────────────────────────────
export const HistorialController = {
    mount: (container) => {
        _cacheDOM(container);
        _bindEvents(container);
    }
};
