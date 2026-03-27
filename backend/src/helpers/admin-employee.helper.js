import { AppError } from '../utils/errors.util.js';
import * as modelEmployee from '../models/admin-employee.model.js';
import { hashPin, isValidPinFormat } from '../utils/pin.util.js';

// ==========================================
// 1. INTEGRACIONES HR (Webhooks y Sincronización)
// ==========================================

export const syncHrCatalogs = async (state, c) => {
    const catalogs = state.payload.catalogo_puestos || [];
    if (!Array.isArray(catalogs) || catalogs.length === 0) return { status: 'COMPLETED' };

    for (const item of catalogs) {
        const areaId = item.codigo_area || String(item.areaId || '');
        const areaName = item.nombre_area || item.areaName;
        const jobTitleId = item.codigo_puesto || String(item.jobTitleId || '');
        const jobTitleName = item.nombre_puesto || item.jobTitleName;

        if (!areaId || !areaName || !jobTitleId || !jobTitleName) continue;

        try {
            await modelEmployee.upsertHrCatalog(c, { areaId, areaName, jobTitleId, jobTitleName });
        } catch (err) {
            console.error(`[HR Sync] Error sincronizando catálogo:`, err);
            throw new AppError("Error ejecutando SP de catálogos", 500);
        }
    }
    return { status: 'COMPLETED' };
};

export const processHrWebhook = async (state, c) => {
    const empData = state.payload.data || state.payload;
    const action = state.payload.action || 'alta';
    const employeeNumber = String(empData.numero_empleado || empData.employeeNumber || '');
    const firstName = empData.nombre || empData.firstName || empData.first_name;
    const lastName = empData.apellidos || empData.lastName || empData.last_name || '';
    const areaId = String(empData.codigo_area || empData.areaId || empData.area || '');
    const jobTitleId = String(empData.codigo_puesto || empData.jobTitleId || empData.codigoPuesto || '');
    const hireDate = empData.fecha_llegada || empData.fecha_alta || empData.arrivalDate || empData.hire_date;

    // Evaluamos el estado activo considerando también la nueva propiedad 'action'
    let isActive = empData.is_active !== undefined ? empData.is_active : (empData.isActive !== undefined ? empData.isActive : true);
    if (action === 'baja') {
        isActive = false;
    }

    if (!employeeNumber || !firstName || !areaId || !jobTitleId || !hireDate) {
        throw new AppError("Rechazado: Faltan datos obligatorios", 400);
    }

    const positionCode = `${areaId}-${jobTitleId}`;
    const dictRes = await modelEmployee.viewDictionaryPositions(c, positionCode);

    if (dictRes.length === 0) {
        throw new AppError(`Rechazado: La posición '${positionCode}' no existe.`, 400);
    }

    // Regla MDM: Protección contra datos antiguos
    const existing = await modelEmployee.checkEmployeeExists(c, employeeNumber);
    if (existing) {
        const dbDate = existing.hireDate ? new Date(existing.hireDate).toISOString().split('T')[0] : '1900-01-01';
        const payloadDate = new Date(hireDate).toISOString().split('T')[0];

        if (payloadDate === dbDate) throw new AppError("Rechazado: Empleado duplicado (Misma fecha).", 400);
        if (payloadDate < dbDate) throw new AppError("Rechazado: Payload más antiguo que la BD.", 400);
    }

    try {

        const hrPayload = { employeeNumber, firstName, lastName, areaId, jobTitleId, hireDate, isActive };
        await _hashPinIfPresent(hrPayload);
        await modelEmployee.upsertEmployee(c, hrPayload);
        return { status: 'COMPLETED' };
    } catch (e) {
        throw new AppError("Error interno procesando el empleado", 500);
    }
};

// ==========================================
// 2. EMPLEADOS (CRUD UI y Guardado Masivo)
// ==========================================

export const getEmployees = async (state, c) => {
    try {
        const employees = await modelEmployee.getAllEmployees(c);
        state.responseData = employees;
        state.data = employees;
        return { status: 'COMPLETED' };
    } catch (error) {
        throw new AppError("Error al obtener el directorio de empleados", 500);
    }
};

export const validateEmployeeExists = async (state, c) => {
    const employeeNumber = String(state.params?.employeeNumber || state.params?.id || state.payload?.employeeNumber || '');
    if (!employeeNumber) throw new AppError("No se proporcionó el número de empleado para la validación.", 400);

    try {
        const existing = await modelEmployee.checkEmployeeExists(c, employeeNumber);
        if (!existing) throw new AppError(`Rechazado: El empleado con número '${employeeNumber}' no existe.`, 404);

        state.employeeContext = existing;
        return { status: 'COMPLETED' };
    } catch (e) {
        if (e instanceof AppError) throw e;
        throw new AppError("Error en base de datos al validar empleado", 500);
    }
};

export const saveEmployee = async (state, c) => {
    const payload = state.payload;
    payload.employeeNumber = payload.employeeNumber;
    payload.hireDate = payload.hireDate || new Date().toISOString().split('T')[0];

    // Creación: requiere todos los campos
    if (!payload.employeeNumber || !payload.firstName || !payload.areaId || !payload.jobTitleId) {
        throw new AppError("Faltan propiedades requeridas para guardar el empleado", 400);
    }

    try {
        await _hashPinIfPresent(payload);
        await modelEmployee.upsertEmployee(c, payload);
        return { status: 'COMPLETED' };
    } catch (e) {
        throw new AppError("Fallo en base de datos al generar empleado", 500);
    }
};

export const updateEmployee = async (state, c) => {
    const payload = state.payload;
    payload.employeeNumber = state.params?.employeeNumber;

    // Actualización: solo necesita saber a quién tocar
    if (!payload.employeeNumber) {
        throw new AppError("Se requiere employeeNumber para actualizar", 400);
    }

    try {
        await _hashPinIfPresent(payload);
        await modelEmployee.upsertEmployee(c, payload);
        return { status: 'COMPLETED' };
    } catch (e) {
        throw new AppError("Fallo en base de datos al actualizar empleado", 500);
    }
};

export const deactivateEmployeeData = async (state, c) => {
    const employeeNumber = String(state.params?.employeeNumber || '');
    if (!employeeNumber) throw new AppError("Rechazado: Se requiere el número de empleado para procesar la baja.", 400);

    try {
        await modelEmployee.deactivateEmployee(c, employeeNumber);
        return { status: 'COMPLETED' };
    } catch (e) {
        throw new AppError("Fallo en base de datos al desactivar al empleado", 500);
    }
};

export const bulkSaveEmployees = async (state, c) => {
    const employees = state.payload.employees || [];

    for (const emp of employees) {
        if (!emp.employeeNumber || !emp.firstName || !emp.areaId || !emp.jobTitleId) continue;

        // Regla MDM fusionada desde el antiguo hr.helper
        const existing = await modelEmployee.checkEmployeeExists(c, emp.employeeNumber);
        if (existing) {
            const dbDate = existing.hireDate ? new Date(existing.hireDate).toISOString().split('T')[0] : '1900-01-01';
            const payloadDate = emp.hireDate ? new Date(emp.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            // Si el payload es más viejo que la BD, lo ignoramos para proteger los datos
            if (payloadDate < dbDate) continue;
        }

        const empPayload = {
            employeeNumber: emp.employeeNumber,
            firstName: emp.firstName,
            lastName: emp.lastName || '',
            areaId: emp.areaId,
            jobTitleId: emp.jobTitleId,
            hireDate: emp.hireDate || new Date().toISOString().split('T')[0],
            isActive: emp.isActive !== undefined ? emp.isActive : true
        };
        await _hashPinIfPresent(empPayload);
        await modelEmployee.upsertEmployee(c, empPayload);
    }

    return { status: 'COMPLETED' };
};


// ==========================================
// 3. CATÁLOGOS: ÁREAS (CRUD y Bulk)
// ==========================================

export const getAreas = async (state, c) => {
    const areas = await modelEmployee.getAllAreas(c);
    state.data = areas;
    return { status: 'COMPLETED' };
};

export const createArea = async (state, c) => {
    await modelEmployee.insertAreaModel(c, state.payload.code, state.payload.areaName);
    return { status: 'COMPLETED' };
};

export const updateArea = async (state, c) => {
    await modelEmployee.updateAreaModel(
        c,
        state.params?.code,
        state.payload.areaName,
        state.payload.canAccessCashier ?? null
    );
    return { status: 'COMPLETED' };
};

export const deactivateArea = async (state, c) => {
    await modelEmployee.deactivateAreaModel(c, state.params?.code);
    return { status: 'COMPLETED' };
};

export const bulkUpdateAreas = async (state, c) => {
    const areas = state.payload.areas || [];
    for (const area of areas) {
        if (area.code && area.areaName) {
            await modelEmployee.updateAreaModel(c, area.code, area.areaName);
        }
    }
    return { status: 'COMPLETED' };
};

export const bulkDeactivateAreas = async (state, c) => {
    const codes = state.payload.codes || [];
    if (codes.length > 0) await modelEmployee.bulkDeactivateAreasModel(c, codes);
    return { status: 'COMPLETED' };
};


// ==========================================
// 4. CATÁLOGOS: PUESTOS (CRUD y Bulk)
// ==========================================

export const getJobTitles = async (state, c) => {
    const jobTitles = await modelEmployee.getAllJobTitles(c);
    state.data = jobTitles;
    return { status: 'COMPLETED' };
};

export const createJobTitle = async (state, c) => {
    await modelEmployee.insertJobTitleModel(c, state.payload.code, state.payload.jobTitleName);
    return { status: 'COMPLETED' };
};

export const updateJobTitle = async (state, c) => {
    await modelEmployee.updateJobTitleModel(c, state.params?.code, state.payload.jobTitleName);
    return { status: 'COMPLETED' };
};

export const deactivateJobTitle = async (state, c) => {
    await modelEmployee.deactivateJobTitleModel(c, state.params?.code);
    return { status: 'COMPLETED' };
};

export const bulkUpdateJobTitles = async (state, c) => {
    const jobTitles = state.payload.jobTitles || [];
    for (const jt of jobTitles) {
        if (jt.code && jt.jobTitleName) {
            await modelEmployee.updateJobTitleModel(c, jt.code, jt.jobTitleName);
        }
    }
    return { status: 'COMPLETED' };
};

export const bulkDeactivateJobTitles = async (state, c) => {
    const codes = state.payload.codes || [];
    if (codes.length > 0) await modelEmployee.bulkDeactivateJobTitlesModel(c, codes);
    return { status: 'COMPLETED' };
};

const _hashPinIfPresent = async (payload) => {
    if (payload.pinCode !== undefined && payload.pinCode !== null) {
        const pinStr = String(payload.pinCode);

        if (!isValidPinFormat(pinStr)) {
            throw new AppError('El PIN debe ser de 4 a 6 dígitos numéricos.', 400);
        }

        payload.pinCode = await hashPin(pinStr);
    }
    return payload;
};