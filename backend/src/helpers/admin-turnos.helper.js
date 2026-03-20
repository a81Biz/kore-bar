// src/helpers/admin-turnos.helper.js
import { AppError } from '../utils/errors.util.js';
import * as turnosModel from '../models/admin-turnos.model.js';

// ── GET CATÁLOGO DE TURNOS ────────────────────────────────────
export const getShifts = async (state, c) => {
    try {
        const shifts = await turnosModel.getShifts(c);

        if (!state.data) state.data = {};

        state.data.shifts = shifts;

    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError(`Error obteniendo el catálogo de turnos '${error}`, 500);
    }
};

// ── CREATE TURNO ──────────────────────────────────────────────
export const createShift = async (state, c) => {
    const { code, name, startTime, endTime } = state.payload;
    try {
        await turnosModel.createShift(c, code.toUpperCase(), name, startTime, endTime);
    } catch (error) {
        if (error.isOperational) throw error;
        if (error.code === '23505' || error.message?.includes('ya existe')) {
            throw new AppError(`El código de turno '${code}' ya existe`, 400);
        }
        throw new AppError('Error creando el turno', 500);
    }
};

// ── MONITOR DE ASISTENCIA ─────────────────────────────────────
export const getAttendance = async (state, c) => {
    const { date, startDate, endDate, employeeNumber } = state.payload || {};
    try {
        const rows = await turnosModel.getAttendance(c, { date, startDate, endDate, employeeNumber });

        // Calcular stats en el helper para no hacerlo en el frontend
        const stats = {
            total: rows.length,
            presente: rows.filter(r => r.attendanceStatus === 'PRESENTE').length,
            esperado: rows.filter(r => r.attendanceStatus === 'ESPERADO').length,
            ausente: rows.filter(r => r.attendanceStatus === 'AUSENTE').length
        };

        state.data = { records: rows, stats };
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo el monitor de asistencia', 500);
    }
};

// ── RESET DE PIN ──────────────────────────────────────────────
export const resetEmployeePin = async (state, c) => {
    const employeeNumber = state.params?.employeeNumber;
    const { newPin } = state.payload;

    if (!employeeNumber) throw new AppError('El número de empleado es requerido como parámetro de ruta', 400);

    // Validar PIN: 4–6 dígitos numéricos
    if (!/^\d{4,6}$/.test(String(newPin))) {
        throw new AppError('El PIN debe contener entre 4 y 6 dígitos numéricos', 400);
    }

    try {
        await turnosModel.resetPin(c, employeeNumber, String(newPin));

        if (!state.data) state.data = {};

        state.data.message = `PIN del empleado ${employeeNumber} actualizado exitosamente`;
    } catch (error) {
        if (error.isOperational) throw error;
        if (error.code === 'P0002' || error.message?.includes('no encontrado')) {
            throw new AppError(`Empleado '${employeeNumber}' no encontrado o inactivo`, 404);
        }
        if (error.code === '23505' || error.message?.includes('pin_code')) {
            throw new AppError(`El PIN indicado ya está en uso por otro empleado. Elige uno diferente.`, 409);
        }
        throw new AppError('Error al resetear el PIN', 500);
    }
};