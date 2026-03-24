// src/helpers/admin-payroll.helper.js
import { AppError } from '../utils/errors.util.js';
import * as payrollModel from '../models/admin-payroll.model.js';

const VALID_DEDUCTION_TYPES = [
    'FALTA_INJUSTIFICADA',
    'RETARDO',
    'PERMISO_SIN_GOCE',
    'DIA_ECONOMICO',
    'SUSPENSION',
    'SANCION'
];

// ── GET /admin/attendance/payroll ─────────────────────────────
// Devuelve el historial agrupado por empleado.
// Cada empleado tiene: info, resumen numérico y array de días.
export const getPayrollHistory = async (state, c) => {
    const { startDate, endDate, employeeNumber, areaCode } = state.payload || {};

    try {
        const rows = await payrollModel.getPayrollHistory(c, {
            startDate, endDate, employeeNumber, areaCode
        });

        // Agrupar por empleado
        const employeeMap = new Map();

        rows.forEach(row => {
            const key = row.employeeNumber;

            if (!employeeMap.has(key)) {
                employeeMap.set(key, {
                    employeeNumber: row.employeeNumber,
                    firstName:      row.firstName,
                    lastName:       row.lastName,
                    areaCode:       row.areaCode,
                    areaName:       row.areaName,
                    jobTitle:       row.jobTitle,
                    summary: {
                        totalDays:    0,
                        daysWorked:   0,
                        absences:     0,
                        payableDays:  0,
                        deductions:   0
                    },
                    days: []
                });
            }

            const emp = employeeMap.get(key);
            emp.summary.totalDays++;
            if (row.workedDay)    emp.summary.daysWorked++;
            else                  emp.summary.absences++;
            if (row.payDay)       emp.summary.payableDays++;
            if (row.hasDeduction) emp.summary.deductions++;

            emp.days.push({
                workDate:       row.workDate,
                shiftName:      row.shiftName,
                startTime:      row.startTime,
                endTime:        row.endTime,
                checkInAt:      row.check_in_at
                    ? new Date(row.check_in_at).toISOString()
                    : null,
                checkinSource:  row.checkinSource,
                workedDay:      row.workedDay,
                payDay:         row.payDay,
                hasDeduction:   row.hasDeduction,
                deductionId:    row.deductionId,
                deductionType:  row.deductionType,
                motivo:         row.motivo,
                appliedBy:      row.appliedBy,
                rosterSource:   row.rosterSource
            });
        });

        const employees = Array.from(employeeMap.values());

        // Resumen global del período
        const summary = {
            totalEmployees: employees.length,
            period: { startDate, endDate },
            totals: {
                totalDays:   employees.reduce((s, e) => s + e.summary.totalDays,   0),
                daysWorked:  employees.reduce((s, e) => s + e.summary.daysWorked,  0),
                absences:    employees.reduce((s, e) => s + e.summary.absences,    0),
                payableDays: employees.reduce((s, e) => s + e.summary.payableDays, 0),
                deductions:  employees.reduce((s, e) => s + e.summary.deductions,  0)
            }
        };

        state.data = { employees, summary };
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error obteniendo el historial de nómina', 500);
    }
};


// ── POST /admin/attendance/deductions ─────────────────────────
export const createPayrollDeduction = async (state, c) => {
    const { employeeNumber, deductionDate, deductionType, motivo } = state.payload;

    if (!VALID_DEDUCTION_TYPES.includes(deductionType)) {
        throw new AppError(
            `Tipo de descuento inválido. Valores permitidos: ${VALID_DEDUCTION_TYPES.join(', ')}`,
            400
        );
    }

    // El admin que aplica el descuento viene del token de sesión
    const appliedBy = state.user?.employeeNumber || 'ADMIN';

    try {
        await payrollModel.createDeduction(c, employeeNumber, deductionDate, deductionType, motivo, appliedBy);
        state.message = `Descuento "${deductionType}" aplicado al empleado ${employeeNumber} para el ${deductionDate}.`;
    } catch (error) {
        if (error.code === 'P0002' || error.message?.includes('no encontrado')) {
            throw new AppError(`Empleado ${employeeNumber} no encontrado`, 404);
        }
        if (error.isOperational) throw error;
        throw new AppError('Error aplicando el descuento', 500);
    }
};


// ── DELETE /admin/attendance/deductions/:id ───────────────────
export const deletePayrollDeduction = async (state, c) => {
    const { id } = state.params;
    if (!id) throw new AppError('El ID del descuento es requerido', 400);

    try {
        await payrollModel.deleteDeduction(c, id);
        state.message = 'Descuento eliminado correctamente.';
    } catch (error) {
        if (error.code === 'P0002' || error.message?.includes('no encontrado')) {
            throw new AppError('Descuento no encontrado', 404);
        }
        if (error.isOperational) throw error;
        throw new AppError('Error eliminando el descuento', 500);
    }
};


// ── GET /admin/attendance/payroll/export ──────────────────────
// Devuelve datos estructurados para CSV o envío JSON a RRHH.
// El frontend decide si descarga CSV o envía a URL externa.
export const exportPayrollData = async (state, c) => {
    const { startDate, endDate } = state.payload || {};

    if (!startDate || !endDate) {
        throw new AppError('Se requieren startDate y endDate para exportar', 400);
    }

    try {
        const rows = await payrollModel.getPayrollExport(c, { startDate, endDate });

        // Totales globales
        const totals = rows.reduce((acc, r) => {
            acc.totalDays    += parseInt(r.totalDays    || 0);
            acc.daysWorked   += parseInt(r.daysWorked   || 0);
            acc.payableDays  += parseInt(r.payableDays  || 0);
            acc.deductions   += parseInt(r.deductions   || 0);
            return acc;
        }, { totalDays: 0, daysWorked: 0, payableDays: 0, deductions: 0 });

        state.data = {
            period: { startDate, endDate },
            rows,   // Una fila por empleado con totales
            totals
        };
    } catch (error) {
        if (error.isOperational) throw error;
        throw new AppError('Error generando exportación de nómina', 500);
    }
};
