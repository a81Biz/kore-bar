import * as FloorModel from '../models/admin-floor.model.js';
import { AppError } from '../utils/errors.util.js';

// ============================================================
// ZONAS
// ============================================================
export const saveZone = async (state, c) => {
    const { zoneCode, name } = state.payload;
    try {
        await FloorModel.createZone(c, zoneCode, name);
        state.message = 'Zona creada exitosamente';
    } catch (error) {
        if (error.code === '23505') throw new AppError('El código de zona ya existe', 400);
        throw new AppError(`Error creando zona: ${error.message}`, 500);
    }
};

export const updateZone = async (state, c) => {
    const { code } = state.params;
    const { name, isActive } = state.payload;
    try {
        await FloorModel.updateZone(c, code, name, isActive);
        state.message = 'Zona actualizada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in updateZone:', error);
        throw new AppError(`Error actualizando zona: ${error.message}`, 500);
    }
};

export const getZones = async (state, c) => {
    try {
        state.zones = await FloorModel.getActiveZones(c);
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getZones:', error);
        throw new AppError('Error obteniendo zonas', 500);
    }
};

export const deleteZone = async (state, c) => {
    const { code } = state.params;
    try {
        await FloorModel.deleteZoneSmart(c, code);
        state.message = 'Zona eliminada exitosamente';
    } catch (error) {
        if (error.code === 'P0001') throw new AppError(error.message, 400);
        if (error.isOperational) throw error;
        console.error('Raw DB Error in deleteZone:', error);
        throw new AppError(`Error eliminando zona: ${error.message}`, 500);
    }
};

// ============================================================
// MESAS
// ============================================================
export const saveTable = async (state, c) => {
    const { tableId, zoneCode, capacity } = state.payload;
    try {
        await FloorModel.createTable(c, tableId, zoneCode, capacity);
        state.message = 'Mesa creada exitosamente';
    } catch (error) {
        if (error.code === 'P0002') throw new AppError('La zona asignada no existe', 400);
        if (error.code === '23505') throw new AppError('El código de mesa ya existe', 400);
        if (error.code === '23514') throw new AppError('La capacidad debe ser mayor a 0', 400);
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveTable:', error);
        throw new AppError(`Error creando mesa: ${error.message}`, 500);
    }
};

export const updateTable = async (state, c) => {
    const { id } = state.params;
    const { zoneCode, capacity, isActive } = state.payload;
    try {
        await FloorModel.updateTable(c, id, zoneCode, capacity, isActive);
        state.message = 'Mesa actualizada exitosamente';
    } catch (error) {
        if (error.code === 'P0002') throw new AppError('La zona asignada no existe', 400);
        if (error.code === '23514') throw new AppError('La capacidad debe ser mayor a 0', 400);
        if (error.isOperational) throw error;
        console.error('Raw DB Error in updateTable:', error);
        throw new AppError(`Error actualizando mesa: ${error.message}`, 500);
    }
};

export const getTables = async (state, c) => {
    try {
        state.tables = await FloorModel.getActiveTables(c);
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getTables:', error);
        throw new AppError('Error obteniendo mesas', 500);
    }
};

export const deleteTable = async (state, c) => {
    const { id } = state.params;
    try {
        await FloorModel.deleteTableSmart(c, id);
        state.message = 'Mesa eliminada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in deleteTable:', error);
        throw new AppError(`Error eliminando mesa: ${error.message}`, 500);
    }
};

// ============================================================
// ASIGNACIONES OPERATIVAS
// ============================================================
export const saveAssignment = async (state, c) => {
    const { employeeNumber, zoneCode, shift, assignmentDate, recurrence } = state.payload;

    let daysToAdd = 0;
    if (recurrence === 'SEMANA') daysToAdd = 6;
    if (recurrence === 'MES') daysToAdd = 29;

    const startDateObj = new Date(`${assignmentDate}T12:00:00Z`);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + daysToAdd);

    const startDate = startDateObj.toISOString().split('T')[0];
    const endDate = endDateObj.toISOString().split('T')[0];

    try {
        await FloorModel.createAssignmentRange(c, employeeNumber, zoneCode, shift, startDate, endDate);
        state.message = 'Asignación de turnos exitosa';
    } catch (error) {
        if (error.code === 'P0002') throw new AppError('La zona asignada no existe', 400);
        if (error.code === '23505') {
            if (error.message.includes('uq_fatiga_empleado')) {
                throw new AppError('COLISIÓN: El empleado ya tiene un turno asignado en el rango de fechas seleccionado.', 409);
            }
            if (error.message.includes('uq_sobrecupo_zona')) {
                throw new AppError('COLISIÓN: La zona ya está ocupada por otro mesero en el rango de fechas seleccionado.', 409);
            }
            throw new AppError('Error de colisión en el calendario.', 409);
        }
        if (error.isOperational) throw error;
        console.error('Raw DB Error in saveAssignment:', error);
        throw new AppError(`Error al guardar asignación: ${error.message}`, 500);
    }
};

export const getAssignments = async (state, c) => {
    // date llega como query param → schemaRouter lo inyecta en state.payload
    const date = state.payload?.date || new Date().toISOString().split('T')[0];
    try {
        state.assignments = await FloorModel.getAssignmentsByDate(c, date);
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in getAssignments:', error);
        throw new AppError(`Error al obtener asignaciones: ${error.message}`, 500);
    }
};

export const deleteAssignment = async (state, c) => {
    const { id } = state.params;
    try {
        await FloorModel.deleteAssignment(c, id);
        state.message = 'Asignación eliminada exitosamente';
    } catch (error) {
        if (error.isOperational) throw error;
        console.error('Raw DB Error in deleteAssignment:', error);
        throw new AppError(`Error al eliminar asignación: ${error.message}`, 500);
    }
};