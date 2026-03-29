import { postData, fetchData, putData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showErrorModal, showSuccessModal } from '/shared/js/ui.js';
import { state } from './state.js';
import { render, renderAreasCashier } from './view.js';
import { MDMEngine } from '../../rules/mdm.engine.js';

// ==========================================
// ADAPTADOR / MAPPER DE RRHH
// ==========================================
const hrMapper = {
    employee_number: ['numero_empleado', 'id_empleado', 'employeeNumber', 'id', 'emp_id'],
    first_name: ['nombre', 'first_name', 'firstName', 'nombres'],
    last_name: ['apellidos', 'last_name', 'lastName', 'apellido'],
    area_code: ['codigo_area', 'id_area', 'areaId', 'area', 'departamento'],
    job_title_code: ['codigo_puesto', 'id_puesto', 'jobTitleId', 'puesto'],
    hire_date: ['fecha_llegada', 'fecha_alta', 'hireDate', 'fecha_ingreso', 'created_at'],
    is_active: ['is_active', 'isActive', 'activo', 'status', 'estado']
};

const mapEmployeeData = (rawEmp) => {
    const mapped = {};
    for (const [sysKey, hrKeys] of Object.entries(hrMapper)) {
        const foundKey = hrKeys.find(k => rawEmp[k] !== undefined && rawEmp[k] !== null);
        mapped[sysKey] = foundKey ? String(rawEmp[foundKey]).trim() : '';
    }

    if (mapped.is_active === 'false' || mapped.is_active === '0' || mapped.is_active?.toLowerCase() === 'inactivo') {
        mapped.is_active = false;
    } else {
        mapped.is_active = true;
    }
    return mapped;
};

// ==========================================
// CONSTRUCTOR DE CATÁLOGOS
// ==========================================
const buildPuestosCatalog = (areas, jobTitles) => {
    const catalog = {};
    const allPuestos = (jobTitles || []).map(p => ({ id: p.code, nombre: p.name }));

    (areas || []).forEach(area => {
        catalog[area.code] = {
            nombre: area.name,
            puestos: allPuestos
        };
    });
    return catalog;
};

// ==========================================
// LÓGICA DE NEGOCIO
// ==========================================
export const logic = {
    loadAll: async () => {
        try {
            const resEmpleados = await fetchData(ENDPOINTS.admin.get.employees).catch(() => ({ data: [] }));
            const resAreas = await fetchData(ENDPOINTS.admin.get.areas).catch(() => ({ data: [] }));
            const resPuestos = await fetchData(ENDPOINTS.admin.get.jobTitles).catch(() => ({ data: [] }));

            const rawEmpleados = resEmpleados?.data || [];
            state.datos.puestosCatalog = buildPuestosCatalog(resAreas.data, resPuestos.data);

            const borradoresActuales = state.datos.empleados.filter(e => e.isDraft);
            const empleadosBD = rawEmpleados.filter(emp => emp.employee_number).map(emp => ({
                ...emp,
                isDraft: false,
                _syncState: 'saved'
            }));

            state.datos.empleados = [...empleadosBD, ...borradoresActuales];
            render.tabla();
        } catch (err) {
            console.error('[Empleados] Error inicial:', err);
        }
    },

    prepararEdicion: (employeeId) => {
        const emp = state.datos.empleados.find(e => String(e.employee_number) === String(employeeId));
        if (!emp) return;

        state.dom.inputEditId.value = emp.employee_number;
        state.dom.inputEditNombre.value = emp.first_name || '';
        state.dom.inputEditApellidos.value = emp.last_name || '';
        state.dom.checkEditActive.checked = emp.is_active;

        render.areas(emp.area_code);
        render.puestos(emp.area_code, emp.job_title_code);
        render.modalOpen();
    },

    syncHR: async () => {
        const fileInput = state.dom.inputUrlSync;
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            showErrorModal('Por favor selecciona un archivo JSON para sincronizar.', 'Archivo Requerido');
            return;
        }

        const formPayload = { action: 'SYNC_HR', targetUrl: 'file-upload' };

        const validacionSync = state.motorValidacion.execute(formPayload);
        if (!validacionSync.isValid) {
            showErrorModal(validacionSync.error, 'Validación Fallida');
            return;
        }

        try {
            const file = fileInput.files[0];
            const textData = await file.text();
            let jsonData;
            try {
                jsonData = JSON.parse(textData);
            } catch (err) {
                throw new Error('El archivo seleccionado no tiene un formato JSON válido.');
            }

            // 1. Sincronizar Catálogos en V2
            const catalogos = jsonData.catalogo_puestos || jsonData.catalogo_areas_puestos || [];
            if (catalogos.length > 0) {
                await postData(ENDPOINTS.admin.post.syncCatalogs, { catalogo_puestos: catalogos }).catch(() => { });
            }

            // 2. Traer catálogos frescos
            const resEmpleados = await fetchData(ENDPOINTS.admin.get.employees).catch(() => ({ data: [] }));
            const resAreas = await fetchData(ENDPOINTS.admin.get.areas).catch(() => ({ data: [] }));
            const resPuestos = await fetchData(ENDPOINTS.admin.get.jobTitles).catch(() => ({ data: [] }));

            state.datos.puestosCatalog = buildPuestosCatalog(resAreas.data, resPuestos.data);

            const dbEmpleados = (resEmpleados?.data || []).filter(e => e.employee_number);
            const dbMap = new Map(dbEmpleados.map(e => [String(e.employee_number), e]));

            const hrEmpleadosRaw = Array.isArray(jsonData) ? jsonData : (jsonData.empleados || jsonData.data || []);

            // 3. Traducción y Deduplicación
            const hrUnicos = new Map();
            for (const raw of hrEmpleadosRaw) {
                const payload = raw.data ? raw.data : raw;
                const norm = mapEmployeeData(payload);
                // Le inyectamos la acción para que el MDMEngine sepa qué hacer
                norm.action = raw.action || 'alta';

                if (norm.employee_number && !hrUnicos.has(norm.employee_number)) {
                    hrUnicos.set(norm.employee_number, { payload, norm });
                }
            }

            const reconciledList = [];
            state.datos.syncStats = { saved: 0, pending: 0, orphan: 0 };

            // 4. CICLO DE RECONCILIACIÓN MDM (El motor en acción)
            for (const { norm: normalizedEmp } of hrUnicos.values()) {

                // A) Validación de integridad (Faltan IDs o Nombres)
                const validacionEmp = state.motorValidacion.execute({
                    action: 'RECONCILE_EMPLOYEE',
                    empJson: normalizedEmp
                });

                if (!validacionEmp.isValid) {
                    console.warn(`[Integridad] Empleado descartado:`, validacionEmp.error);
                    continue; // Al fallar la estructura, lo ignoramos totalmente
                }

                const id = normalizedEmp.employee_number;
                const dbMatch = dbMap.get(id);

                // B) Evaluación del Motor MDM
                const decision = MDMEngine.evaluate(normalizedEmp, dbMatch);

                // Si el motor rechaza por ser un payload muy viejo, preservamos la BD
                if (decision.action === 'REJECT') {
                    console.warn(`[MDM Engine] ID ${id} bloqueado: ${decision.log}`);
                    if (dbMatch) {
                        reconciledList.push({ ...dbMatch, _syncState: 'saved', isDraft: false });
                        state.datos.syncStats.saved++;
                        dbMap.delete(id);
                    }
                    continue;
                }

                // C) Mezclar datos (Si falta info en HR, hereda lo que ya tenía en la BD)
                const finalEmp = { ...(dbMatch || {}), ...normalizedEmp };
                finalEmp._syncState = decision.syncState;
                finalEmp.isDraft = !dbMatch;

                // Forzar la bandera de activo/inactivo según la orden del MDM
                if (decision.action === 'DEACTIVATE') {
                    finalEmp.is_active = false;
                } else if (['REACTIVATE', 'CREATE', 'UPDATE'].includes(decision.action)) {
                    finalEmp.is_active = true;
                } else if (decision.action === 'IGNORE') {
                    finalEmp.is_active = dbMatch ? dbMatch.is_active : false;
                }

                reconciledList.push(finalEmp);

                if (decision.syncState === 'pending') state.datos.syncStats.pending++;
                if (decision.syncState === 'saved') state.datos.syncStats.saved++;

                // Eliminamos del mapa para saber que ya lo atendimos (Evita que se vuelva Huérfano)
                if (dbMatch) dbMap.delete(id);
            }

            // 5. EVALUACIÓN DE ORfandad (Los que ya no vinieron en el JSON)
            dbMap.forEach((dbEmp) => {
                const decision = MDMEngine.evaluate(null, dbEmp);
                const finalEmp = { ...dbEmp };
                finalEmp._syncState = decision.syncState;
                finalEmp.isDraft = false;

                if (decision.syncState === 'orphan') state.datos.syncStats.orphan++;
                if (decision.syncState === 'saved') state.datos.syncStats.saved++; // Baja histórica

                reconciledList.push(finalEmp);
            });

            state.datos.empleados = reconciledList;
            render.tabla();
            render.stats();
            showSuccessModal(`Sincronización completada.`, 'Auditoría Exitosa');

        } catch (error) {
            console.error('[MDM Sync Error]', error);
            showErrorModal(error.message);
        }
    },

    guardarTodosPendientes: async () => {
        const pendientes = state.datos.empleados.filter(e => e._syncState === 'pending');
        if (pendientes.length === 0) return;

        const employeesToSave = pendientes.map(emp => ({
            employeeNumber: emp.employee_number,
            firstName: emp.first_name,
            lastName: emp.last_name,
            areaId: emp.area_code,
            jobTitleId: emp.job_title_code,
            hireDate: emp.hire_date || new Date().toISOString().split('T')[0],
            // Respetamos rigurosamente el is_active que el MDMEngine le haya inyectado
            isActive: emp.is_active !== undefined ? emp.is_active : true
        }));

        try {
            await postData(ENDPOINTS.admin.post.bulkEmployees, { employees: employeesToSave });
            showSuccessModal('Todos los pendientes han sido guardados masivamente.');
            await logic.syncHR();
        } catch (err) {
            showErrorModal(err.message || 'Error al guardar masivamente a los empleados.');
        }
    },

    guardarEdicion: async () => {
        const id = state.dom.inputEditId.value;
        const empEnMemoria = state.datos.empleados.find(e => String(e.employee_number) === String(id));

        const formArea = state.dom.selectEditArea.value;
        const formPuesto = state.dom.selectEditPuesto.value;
        const formNombre = state.dom.inputEditNombre.value.trim();
        const formApellidos = state.dom.inputEditApellidos.value.trim();
        const formActivo = state.dom.checkEditActive.checked;

        const payloadValidacion = {
            action: 'SAVE_EMPLOYEE',
            numero_empleado: id,
            nombre: formNombre,
            apellidos: formApellidos,
            codigo_area: formArea,
            codigo_puesto: formPuesto,
            is_active: formActivo
        };

        const validacion = state.motorValidacion.execute(payloadValidacion);
        if (!validacion.isValid) throw new Error(validacion.error);

        const payload = {
            employeeNumber: id,
            firstName: formNombre,
            lastName: formApellidos,
            areaId: formArea,
            jobTitleId: formPuesto,
            isActive: formActivo,
            hireDate: empEnMemoria ? empEnMemoria.hire_date : new Date().toISOString().split('T')[0]
        };

        let res;
        if (empEnMemoria && empEnMemoria.isDraft) {
            res = await postData(ENDPOINTS.admin.post.employee, payload);
        } else {
            res = await putData(ENDPOINTS.admin.put.employee, payload, { id: id });
        }

        showSuccessModal(res.message || 'Empleado actualizado.', 'Guardado Correcto');
        render.modalClose();

        if (state.dom.inputUrlSync?.value) await logic.syncHR();
        else await logic.loadAll();
    },

    loadAreas: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.areas);
            const areas = res.data || [];
            renderAreasCashier(areas);
            return areas;
        } catch (err) {
            console.error('[Empleados] Error cargando áreas:', err);
            return [];
        }
    },

    toggleCashierAccess: async (code, name, canAccessCashier) => {
        try {
            const url = ENDPOINTS.admin.put.area.replace(':code', code);
            await putData(url, { areaName: name, canAccessCashier });
            const label = canAccessCashier ? 'habilitado' : 'deshabilitado';
            showSuccessModal(`Acceso a caja ${label} para "${name}".`, 'Permiso Actualizado');
        } catch (err) {
            showErrorModal(err.message || 'Error actualizando el permiso de caja.');
            // Revertir el toggle visualmente si falló
            await loadAreas();
        }
    }
};