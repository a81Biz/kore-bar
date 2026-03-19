import { state } from './state.js';

export const render = {
    tabla: () => {
        if (!state.dom.tbody) return;
        state.dom.tbody.innerHTML = '';

        if (state.datos.empleados.length === 0) {
            state.dom.tbody.textContent = '';
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.className = 'p-8 text-center text-slate-500';
            td.textContent = 'No hay empleados registrados.';
            tr.appendChild(td);
            state.dom.tbody.appendChild(tr);
            return;
        }

        const template = document.getElementById('tpl-fila-empleado');

        state.datos.empleados.forEach(emp => {
            const clone = template.content.cloneNode(true);

            const rawId = emp.employee_number || 'N/A';
            const firstName = emp.first_name || '';
            const lastName = emp.last_name || '';
            const nombreCompleto = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : 'Sin Nombre';
            const isActive = emp.is_active !== undefined ? emp.is_active : true;

            const badgeClase = isActive ? state.uiConfig.badges.estados.activo : state.uiConfig.badges.estados.inactivo;
            const badgeTexto = isActive ? 'Activo' : 'Inactivo';

            // Resolución de Catálogos (Para mapear los códigos 10, 20... a "Piso", "Gerencia")
            const objArea = state.datos.puestosCatalog[emp.area_code] || null;
            const nombreAreaVisible = objArea ? objArea.nombre : (emp.area_name || emp.area_code || 'N/A');

            let puestoVisible = emp.job_title_name;
            if (!puestoVisible && objArea && objArea.puestos) {
                const puestoObj = objArea.puestos.find(p => String(p.id) === String(emp.job_title_code));
                if (puestoObj) puestoVisible = puestoObj.nombre;
            }
            if (!puestoVisible) puestoVisible = emp.job_title_code || 'N/A';

            const lookupName = nombreAreaVisible.toUpperCase();
            const areaClass = state.uiConfig.badges.areas[lookupName] || state.uiConfig.badges.areas.DEFAULT;

            clone.querySelector('.col-id').textContent = rawId;
            clone.querySelector('.col-nombre').textContent = nombreCompleto;
            clone.querySelector('.col-puesto').textContent = puestoVisible;

            const badgeArea = clone.querySelector('.col-badge-area');
            badgeArea.textContent = nombreAreaVisible;
            badgeArea.className += ` ${areaClass}`;

            const badgeEstado = clone.querySelector('.col-badge-estado');
            badgeEstado.textContent = badgeTexto;
            badgeEstado.className += ` ${badgeClase}`;

            const syncState = emp._syncState || 'saved';
            const mdmConfig = state.uiConfig.badges.mdm[syncState];
            const mdmBadge = document.createElement('span');
            mdmBadge.className = `ml-2 inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${mdmConfig.color}`;
            
            const mdmIconSpan = document.createElement('span');
            mdmIconSpan.className = 'mr-1';
            mdmIconSpan.textContent = mdmConfig.icon;
            
            mdmBadge.appendChild(mdmIconSpan);
            mdmBadge.appendChild(document.createTextNode(` ${mdmConfig.label}`));
            
            badgeEstado.parentElement.appendChild(mdmBadge);

            const btnEditar = clone.querySelector('.btn-editar');
            btnEditar.dataset.action = 'abrir-modal-editar';
            btnEditar.dataset.id = rawId;

            state.dom.tbody.appendChild(clone);
        });
    },

    stats: () => {
        const stats = state.datos.syncStats;
        if (!stats || !state.dom.statsContainer) return;

        state.dom.statSaved.textContent = stats.saved;
        state.dom.statPending.textContent = stats.pending;
        state.dom.statOrphan.textContent = stats.orphan;

        if (stats.saved > 0 || stats.pending > 0 || stats.orphan > 0) {
            state.dom.statsContainer.classList.remove('hidden');
        } else {
            state.dom.statsContainer.classList.add('hidden');
        }

        if (stats.pending > 0) {
            state.dom.statPendingBtn.textContent = stats.pending;
            state.dom.btnSaveAll.classList.remove('hidden');
        } else {
            state.dom.btnSaveAll.classList.add('hidden');
        }
    },

    areas: (selectedAreaCode = '') => {
        if (!state.dom.selectEditArea) return;
        state.dom.selectEditArea.textContent = '';
        state.dom.selectEditArea.appendChild(new Option('Selecciona un área...', '', true, true)).disabled = true;
        Object.keys(state.datos.puestosCatalog).forEach(areaCode => {
            const opt = document.createElement('option');
            opt.value = areaCode;
            opt.textContent = state.datos.puestosCatalog[areaCode].nombre;
            if (String(areaCode) === String(selectedAreaCode)) opt.selected = true;
            state.dom.selectEditArea.appendChild(opt);
        });
    },

    puestos: (areaCode, selectedPuestoCode = '') => {
        if (!state.dom.selectEditPuesto) return;
        state.dom.selectEditPuesto.textContent = '';
        state.dom.selectEditPuesto.appendChild(new Option('Selecciona un puesto...', '', true, true)).disabled = true;
        const lista = state.datos.puestosCatalog[areaCode]?.puestos || [];
        lista.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            if (String(p.id) === String(selectedPuestoCode)) opt.selected = true;
            state.dom.selectEditPuesto.appendChild(opt);
        });
    },

    modalOpen: () => {
        if (!state.dom.modalEdit) return;
        state.dom.modalEdit.classList.remove('opacity-0', 'pointer-events-none');
        state.dom.modalEdit.querySelector('div').classList.remove('scale-95');
    },

    modalClose: () => {
        if (!state.dom.modalEdit) return;
        state.dom.modalEdit.classList.add('opacity-0', 'pointer-events-none');
        state.dom.modalEdit.querySelector('div').classList.add('scale-95');
        if (state.dom.formEdit) state.dom.formEdit.reset();
    }
};