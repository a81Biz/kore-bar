// ============================================================
// registry.js
// Mapa central de handlers del Workflow Engine.
//
// CONVENCIÓN:
//   - La KEY izquierda es el valor exacto del campo "handler"
//     en el schema JSON.
//   - El VALOR derecho es la función exportada real del helper.
//   - Nunca inventar nombres: si no existe el export, no va aquí.
// ============================================================

// ── AUTH ──────────────────────────────────────────────────────
import {
    loginHandler,
    validatePinHandler
} from '../helpers/auth.helper.js';

// ── RRHH — EMPLEADOS ──────────────────────────────────────────
import {
    syncHrCatalogs,
    processHrWebhook,
    getEmployees,
    validateEmployeeExists,
    saveEmployee,
    updateEmployee,
    deactivateEmployeeData,
    bulkSaveEmployees,
    getAreas,
    createArea,
    updateArea,
    deactivateArea,
    bulkUpdateAreas,
    bulkDeactivateAreas,
    getJobTitles,
    createJobTitle,
    updateJobTitle,
    deactivateJobTitle,
    bulkUpdateJobTitles,
    bulkDeactivateJobTitles
} from '../helpers/admin-employee.helper.js';

import {
    getPayrollHistory,
    createPayrollDeduction,
    deletePayrollDeduction,
    exportPayrollData
} from '../helpers/admin-payroll.helper.js';

// ── LAYOUT — PISO ─────────────────────────────────────────────
import {
    saveZone,
    updateZone,
    getZones,
    deleteZone,
    saveTable,
    updateTable,
    getTables,
    deleteTable,
    createAssignmentRangeHandler,
    getAssignments,
    deleteAssignment
} from '../helpers/admin-floor.helper.js';

// ── MENÚ ─────────────────────────────────────────────────────
import {
    createCategoryHandler,
    updateCategory,
    getCategories,
    deleteCategory,
    createDishHandler,
    updateDishHandler,
    getDishes,
    deleteDishHandler
} from '../helpers/admin-menu.helper.js';

// ── INVENTARIO ────────────────────────────────────────────────
import {
    getSuppliers,
    createSupplier,
    getInventoryStock,
    getKardex,
    saveSupplierPrice,
    getPurchaseSuggestions,
    generatePurchaseSuggestions,
    sendPurchaseOrder,

} from '../helpers/admin-inventory.helper.js';

import {
    saveKardexTransfer,
    syncPurchasesToKardex,
    saveKardexAdjustment
} from '../helpers/inventory-transfers.helper.js';

// ── COCINA / RECETARIO / KDS ──────────────────────────────────
import {
    getPendingDishes,
    createIngredient,
    getIngredients,
    addRecipeItemHandler,
    getFinishedDishes,
    getRecipeBOM,
    updateTechSheet,
    getKitchenBoard,
    updateKitchenItemStatus
} from '../helpers/kitchen.helper.js';

// ── MESEROS ───────────────────────────────────────────────────
import {
    validateWaiterPin,
    getWaiterLayout,
    openTable,
    submitOrder,
    closeTableHandler,
    waiterCollectItem,
    waiterDeliverItem,
    getWaiterOrderStatus,
    getWaiterFloorStock,
    getWaiters
} from '../helpers/waiter.helper.js';

// ── CAJA ─────────────────────────────────────────────────────
import {
    getBoard,
    getCorte,
    getEmployees as getCashierEmployeesHandler,
    getTicketByFolio,
    validateCashierPin,
    submitPayment,
    requestInvoice
} from '../helpers/cashier.helper.js';

// ── MENÚ PÚBLICO ──────────────────────────────────────────────
import {
    getPublicMenu,
    registerWaiterCall,
    getPendingCalls,
    attendWaiterCall
} from '../helpers/public-menu.helper.js';

// ── TURNOS Y ASISTENCIA ───────────────────────────────────────
import {
    getShifts,
    createShift,
    getAttendance,
    resetEmployeePin,
    createScheduleRange,
    getSchedules,
    deleteSchedule,
    getAbsences,
    recordAdminCheckin
} from '../helpers/admin-turnos.helper.js';

// ── REPORTS ───────────────────────────────────────
import {
    fetchSalesReport,
    fetchSalesSummary,
    fetchTopDishes,
    fetchSalesByCategory,
    fetchSalesByWaiter,
    fetchDashboardKpis
} from '../helpers/admin-reports.helper.js';

import {
    fetchTicketPrintData
} from '../helpers/cashier-print.helper.js';

// ============================================================
// MAPA CENTRAL — KEY = handler en schema JSON
// ============================================================
export const ActionRegistry = {

    // Auth
    login: loginHandler,
    validatePin: validatePinHandler,

    // Empleados
    syncHrCatalogs,
    processHrWebhook,
    getEmployees,
    validateEmployeeExists,
    saveEmployee,
    updateEmployee,
    deactivateEmployeeData,
    bulkSaveEmployees,

    //Admin Payroll
    getPayrollHistory,
    createPayrollDeduction,
    deletePayrollDeduction,
    exportPayrollData,

    // Catálogos — Áreas
    getAreas,
    createArea,
    updateArea,
    deactivateArea,
    bulkUpdateAreas,
    bulkDeactivateAreas,

    // Catálogos — Puestos
    getJobTitles,
    createJobTitle,
    updateJobTitle,
    deactivateJobTitle,
    bulkUpdateJobTitles,
    bulkDeactivateJobTitles,

    // Layout — Zonas
    saveZone,
    updateZone,
    getZones,
    deleteZone,

    // Layout — Mesas
    saveTable,
    updateTable,
    getTables,
    deleteTable,

    // Layout — Asignaciones
    saveAssignment: createAssignmentRangeHandler,
    getAssignments,
    deleteAssignment,

    // Menú — Categorías
    saveCategory: createCategoryHandler,
    updateCategory,
    getCategories,
    deleteCategory,

    // Menú — Platillos
    saveDish: createDishHandler,
    updateDish: updateDishHandler,
    getDishes,
    deleteDish: deleteDishHandler,

    // Inventario — Proveedores y stock
    getSuppliers,
    createSupplier,
    getInventoryStock,
    getKardex,
    saveSupplierPrice,

    // Inventario — Traspasos, compras, ajustes
    saveKardexTransfer,
    syncPurchasesToKardex,
    saveKardexAdjustment,

    // Cocina — Recetario
    getPendingDishes,
    createIngredient,
    getIngredients,
    addRecipeItem: addRecipeItemHandler,
    getFinishedDishes,
    getRecipeBOM,
    updateTechSheet,

    // Cocina — KDS
    getKitchenBoard,
    updateKitchenItemStatus,

    // Meseros
    validateWaiterPin,
    getWaiterLayout,
    openTable,
    submitOrder,
    closeTable: closeTableHandler,
    waiterCollectItem,
    waiterDeliverItem,
    getWaiterOrderStatus,
    getWaiterFloorStock,
    getWaiters,

    // Caja
    getCashierBoard: getBoard,
    getCashierCorte: getCorte,
    getCashierEmployees: getCashierEmployeesHandler,
    getTicketByFolio,
    validateCashierPin,
    processPayment: submitPayment,
    requestInvoice,

    // Menú público
    getPublicMenu,
    registerWaiterCall,
    getPendingCalls,
    attendWaiterCall,

    // Turnos y Asistencia
    getShifts,
    createShift,
    getAttendance,
    resetEmployeePin,
    createScheduleRange,
    getSchedules,
    deleteSchedule,
    recordAdminCheckin,

    // Pedidos automáticos
    getPurchaseSuggestions,
    generatePurchaseSuggestions,
    sendPurchaseOrder,

    // Inasistencias
    getAbsences,

    // ── REGISTRO (agregar al objeto de acciones existente) ────────
    // Reportes de ventas
    fetchSalesReport,
    fetchSalesSummary,
    fetchTopDishes,
    fetchSalesByCategory,
    fetchSalesByWaiter,

    // Dashboard KPIs
    fetchDashboardKpis,

    // Impresión de tickets
    fetchTicketPrintData,

};