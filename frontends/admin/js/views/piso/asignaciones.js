import { fetchData, postData, deleteData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { bindForm } from '/shared/js/formEngine.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';
import { ValidatorEngine } from '/shared/js/validationEngine.js';
import { PisoValidationRules } from '../../rules/piso.rules.js';

const state = {
    datos: {
        asignaciones: [],
        empleadosCrudos: [], // Todos los empleados
        puestos: [],         // Catálogo de Puestos
        zonasActivas: [],
        mesasActivas: []
    },
    dom: {
        root: null, form: null, list: null,
        selectPuesto: null, selectMesero: null, selectZona: null, selectTurno: null, selectRecurrencia: null,
        inputFecha: null,
        tbodyResumen: null, tplResumen: null, tplItem: null
    },
    motorValidacion: new ValidatorEngine(PisoValidationRules)
};

const render = {
    cacheDOM: (container) => {
        state.dom.root = container;
        state.dom.form = container.querySelector('#form-piso-asignacion');
        state.dom.selectPuesto = container.querySelector('#asig-puesto');
        state.dom.selectMesero = container.querySelector('#asig-mesero');
        state.dom.selectZona = container.querySelector('#asig-zona');
        state.dom.selectTurno = container.querySelector('#asig-turno');
        state.dom.selectRecurrencia = container.querySelector('#asig-recurrencia');
        state.dom.inputFecha = container.querySelector('#filtro-fecha-asig');

        state.dom.list = container.querySelector('#list-asignaciones');
        state.dom.tplItem = document.querySelector('#tpl-item-asignacion');
        state.dom.tbodyResumen = container.querySelector('#tabla-resumen-body');
        state.dom.tplResumen = document.querySelector('#tpl-fila-resumen');

        if (state.dom.inputFecha) {
            const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit' };
            const hoy = new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
            state.dom.inputFecha.setAttribute('min', hoy);
            if (!state.dom.inputFecha.value) state.dom.inputFecha.value = hoy;
        }
    },

    selectsIniciales: () => {
        if (state.dom.selectZona) {
            state.dom.selectZona.textContent = '';
            state.dom.selectZona.appendChild(new Option('Zona...', '', true, true)).disabled = true;
            state.datos.zonasActivas.forEach(z => {
                state.dom.selectZona.appendChild(new Option(z.name, z.zoneCode));
            });
        }
        if (state.dom.selectPuesto) {
            state.dom.selectPuesto.textContent = '';
            state.dom.selectPuesto.appendChild(new Option('Filtrar Puesto...', '', true, true)).disabled = true;
            state.datos.puestos.forEach(p => {
                state.dom.selectPuesto.appendChild(new Option(p.name, p.code));
            });
        }
    },

    // 🟢 FIX: CASCADA A PRUEBA DE BALAS (CamelCase vs Snake_Case)
    selectMeserosPorPuesto: () => {
        if (!state.dom.selectPuesto || !state.dom.selectMesero) return;
        const id_puesto = state.dom.selectPuesto.value;

        if (!id_puesto) {
            state.dom.selectMesero.textContent = '';
            state.dom.selectMesero.appendChild(new Option('Selecciona puesto primero...', '', true, true)).disabled = true;
            state.dom.selectMesero.disabled = true;
            return;
        }

        const empleadosFiltrados = state.datos.empleadosCrudos.filter(emp => {
            const isActivo = emp.isActive === true || emp.is_active === true;
            const puestoDb = emp.jobTitleId || emp.job_title_code || emp.job_title_id;
            return isActivo && String(puestoDb) === String(id_puesto);
        });

        state.dom.selectMesero.textContent = '';
        state.dom.selectMesero.appendChild(new Option('Selecciona Empleado...', '', true, true)).disabled = true;

        empleadosFiltrados.forEach(m => {
            const num = m.employeeNumber || m.employee_number;
            const nombre = `${m.firstName || m.first_name || ''} ${m.lastName || m.last_name || ''}`.trim();
            state.dom.selectMesero.appendChild(new Option(nombre, num));
        });

        state.dom.selectMesero.disabled = false;
    },

    listasYResumen: () => {
        if (!state.dom.list || !state.dom.tbodyResumen) return;

        state.dom.list.innerHTML = '';
        state.dom.tbodyResumen.innerHTML = '';

        const dateOptions = { day: '2-digit', month: 'short', year: 'numeric' };

        state.datos.asignaciones.forEach(asig => {
            // 🟢 FIX: Búsqueda flexible de Empleados
            const mesero = state.datos.empleadosCrudos.find(m => String(m.employeeNumber || m.employee_number) === String(asig.employeeNumber));
            const zona = state.datos.zonasActivas.find(z => z.zoneCode === asig.zoneCode);
            const mesasDeZona = state.datos.mesasActivas.filter(m => m.zoneCode === asig.zoneCode);

            const nombreMesero = mesero ? `${mesero.firstName || mesero.first_name || ''} ${mesero.lastName || mesero.last_name || ''}`.trim() : asig.employeeNumber;
            const nombreZona = zona ? zona.name : asig.zoneCode;
            const totalPax = mesasDeZona.reduce((sum, mesa) => sum + parseInt(mesa.capacity || 0, 10), 0);

            // Render Lista Lateral
            const clonLista = state.dom.tplItem.content.cloneNode(true);
            clonLista.querySelector('.col-mesero').textContent = nombreMesero;
            clonLista.querySelector('.col-zona').textContent = nombreZona;
            clonLista.querySelector('.col-turno').textContent = asig.shift;

            if (asig.shift === 'VESPERTINO') {
                const badge = clonLista.querySelector('.col-turno');
                badge.className = badge.className.replace('bg-indigo-100', 'bg-amber-100').replace('text-indigo-800', 'text-amber-800');
            }

            const btnLista = clonLista.querySelector('.btn-eliminar');
            btnLista.setAttribute('data-action', 'delete-asignacion');
            btnLista.setAttribute('data-id', asig.id);
            state.dom.list.appendChild(clonLista);

            // Render Tabla Resumen Inferior
            const clonRes = state.dom.tplResumen.content.cloneNode(true);
            clonRes.querySelector('.col-res-mesero').textContent = nombreMesero;
            clonRes.querySelector('.col-res-zona').textContent = nombreZona;
            clonRes.querySelector('.col-res-mesas').textContent = mesasDeZona.length;
            clonRes.querySelector('.col-res-pax').textContent = `${totalPax} pax`;

            const badgeResTurnoSpan = document.createElement('span');
            badgeResTurnoSpan.className = `px-2 py-1 text-xs font-bold rounded ${asig.shift === 'MATUTINO' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`;
            badgeResTurnoSpan.textContent = asig.shift;
            const colResTurno = clonRes.querySelector('.col-res-turno');
            colResTurno.textContent = '';
            colResTurno.appendChild(badgeResTurnoSpan);

            // 🟢 FIX: Procesamiento seguro de la fecha para evitar el "Invalid Date"
            let rawDate = asig.assignmentDate || asig.assignment_date || state.dom.inputFecha.value;

            if (typeof rawDate === 'string') {
                rawDate = rawDate.split('T')[0];
            } else if (rawDate instanceof Date) {
                rawDate = rawDate.toISOString().split('T')[0];
            }

            const fechaBase = new Date(`${rawDate}T12:00:00Z`);
            clonRes.querySelector('.col-res-vigencia').textContent = fechaBase.toLocaleDateString('es-MX', dateOptions);

            state.dom.tbodyResumen.appendChild(clonRes);
        });
    }
};

const logic = {
    cargarCatalogos: async () => {
        try {
            const [resEmpleados, resPuestos] = await Promise.all([
                fetchData(ENDPOINTS.admin.get.employees).catch(() => ({ data: [] })),
                fetchData(ENDPOINTS.admin.get.jobTitles).catch(() => ({ data: [] }))
            ]);

            state.datos.empleadosCrudos = resEmpleados?.data || [];
            state.datos.puestos = resPuestos?.data || []; // 🟢 FIX: Quitamos el filtro estricto

            render.selectsIniciales();
            render.listasYResumen(); // Disparamos render para empatar nombres en el resumen
        } catch (error) {
            console.error('[Asignaciones] Error cargando catálogos:', error);
        }
    },

    cargarAsignaciones: async () => {
        try {
            const fecha = state.dom.inputFecha.value;
            const url = `${ENDPOINTS.admin.get.assignments}?date=${fecha}`;
            const res = await fetchData(url).catch(() => null);
            const arraySeguro = Array.isArray(res?.data?.assignments) ? res.data.assignments : [];

            state.datos.asignaciones = arraySeguro.map(a => ({ ...a, waiterId: a.employeeNumber }));
            render.listasYResumen();
        } catch (error) {
            console.error('[Asignaciones] Error cargando:', error);
        }
    },

    crearAsignacion: async () => {
        if (!state.dom.selectMesero.value) throw new Error('Debes seleccionar un empleado.');

        const payloadValidacion = {
            action: 'CREATE_ASSIGNMENT',
            waiterId: state.dom.selectMesero.value,
            zoneId: state.dom.selectZona.value,
            shift: state.dom.selectTurno.value,
            date: state.dom.inputFecha.value
        };

        const validacion = state.motorValidacion.execute(payloadValidacion, { assignments: state.datos.asignaciones });
        if (!validacion.isValid) {
            showErrorModal(validacion.error, 'Bloqueo de Calendario');
            throw new Error(validacion.error);
        }

        const payloadAPI = {
            employeeNumber: payloadValidacion.waiterId,
            zoneCode: payloadValidacion.zoneId,
            shift: payloadValidacion.shift,
            assignmentDate: payloadValidacion.date,
            recurrence: state.dom.selectRecurrencia.value
        };

        const currentPuesto = state.dom.selectPuesto.value; // Conservar puesto para ráfaga

        await postData(ENDPOINTS.admin.post.assignment, payloadAPI);
        showSuccessModal('Asignación guardada en el calendario.', 'Turno Confirmado');

        setTimeout(() => {
            state.dom.selectPuesto.value = currentPuesto;
            render.selectMeserosPorPuesto(); // Recargar el menú de empleados
        }, 50);

        await logic.cargarAsignaciones();
    },

    eliminarAsignacion: async (id) => {
        if (!await confirmAction('¿Retirar a este empleado del turno?')) return;
        const url = ENDPOINTS.admin.delete.assignment.replace(':id', id);
        await deleteData(url);
        await logic.cargarAsignaciones();
    }
};

const bindEvents = () => {
    if (state.dom.form) bindForm('form-piso-asignacion', logic.crearAsignacion);
    if (state.dom.inputFecha) state.dom.inputFecha.addEventListener('change', logic.cargarAsignaciones);

    // Disparador de la Cascada
    if (state.dom.selectPuesto) state.dom.selectPuesto.addEventListener('change', render.selectMeserosPorPuesto);

    if (state.dom.list) {
        state.dom.list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="delete-asignacion"]');
            if (btn) logic.eliminarAsignacion(btn.getAttribute('data-id'));
        });
    }
};

export const AsignacionesController = {
    mount: async (container) => {
        render.cacheDOM(container);
        bindEvents();
        await logic.cargarCatalogos();
        await logic.cargarAsignaciones();
    },
    actualizarZonas: (zonas) => {
        state.datos.zonasActivas = zonas;
        render.selectsIniciales();
        render.listasYResumen();
    },
    actualizarMesas: (mesas) => {
        state.datos.mesasActivas = mesas;
        render.listasYResumen();
    }
};