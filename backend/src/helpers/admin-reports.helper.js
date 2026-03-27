// ============================================================
// admin-reports.helper.js
// Helper: Reportes de ventas y KPIs del dashboard
// Convención: Recibe state.payload (ya sanitizado por Gatekeeper),
//             aplica lógica de negocio, delega al modelo.
// ============================================================
import * as model from '../models/admin-reports.model.js';
import { AppError } from '../utils/errors.util.js';

/**
 * Valida que las fechas del rango sean coherentes
 */
const _validateDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError('Formato de fecha inválido. Use YYYY-MM-DD.', 400);
    }

    if (start > end) {
        throw new AppError('La fecha de inicio no puede ser posterior a la fecha de fin.', 400);
    }

    // Límite de rango: máximo 1 año
    const diffMs = end - start;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
        throw new AppError('El rango máximo permitido es de 1 año (366 días).', 400);
    }
};

export const fetchSalesReport = async (state, c) => {
    const { startDate, endDate } = state.payload;
    _validateDateRange(startDate, endDate);

    const data = await model.getSalesReport(c, { startDate, endDate });
    state.data = data;
};

export const fetchSalesSummary = async (state, c) => {
    const { startDate, endDate } = state.payload;
    _validateDateRange(startDate, endDate);

    const data = await model.getSalesSummary(c, { startDate, endDate });
    state.data = data;
};

export const fetchTopDishes = async (state, c) => {
    const { startDate, endDate, limit } = state.payload;
    _validateDateRange(startDate, endDate);

    const data = await model.getTopDishes(c, { startDate, endDate, limit });
    state.data = data;
};

export const fetchSalesByCategory = async (state, c) => {
    const { startDate, endDate } = state.payload;
    _validateDateRange(startDate, endDate);

    const data = await model.getSalesByCategory(c, { startDate, endDate });
    state.data = data;
};

export const fetchSalesByWaiter = async (state, c) => {
    const { startDate, endDate } = state.payload;
    _validateDateRange(startDate, endDate);

    const data = await model.getSalesByWaiter(c, { startDate, endDate });
    state.data = data;
};

export const fetchDashboardKpis = async (state, c) => {
    const data = await model.getDashboardKpis(c);
    state.data = data;
};
