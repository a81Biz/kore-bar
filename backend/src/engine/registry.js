// ============================================================
// registry.js
// Mapa central de handlers del Workflow Engine.
// Cada entrada conecta un nombre de handler (usado en los schemas JSON)
// con su función de implementación (helper).
//
// CONVENCIÓN: El nombre del handler debe ser camelCase y corresponder
// exactamente al valor del campo "handler" en los nodos de tipo "action"
// dentro de los schemas JSON.
// ============================================================

// ── RRHH ─────────────────────────────────────────────────────
import {
    syncHrCatalogs,
    saveEmployee,
    updateEmployee,
    deactivateEmployeeData,
    createArea,
    updateArea,
    deactivateArea,
    bulkDeactivateAreas,
    createJobTitle,
    updateJobTitle,
    deactivateJobTitle,
    bulkDeactivateJobTitles
} from '../helpers/admin-employee.helper.js';

// ── LAYOUT ────────────────────────────────────────────────────
import {
    getFloorLayout,
    saveZone,
    updateZoneHandler,
    deleteZoneHandler,
    saveTable,
    updateTableHandler,
    deleteTableHandler,
    createAssignmentRangeHandler,
    deleteAssignmentHandler
} from '../helpers/admin-floor.helper.js';

// ── MENÚ ─────────────────────────────────────────────────────
import {
    getMenuDishes,
    createCategoryHandler,
    updateCategoryHandler,
    deleteCategoryHandler,
    createDishHandler,
    updateDishHandler,
    deleteDishHandler
} from '../helpers/admin-menu.helper.js';

// ── INVENTARIO ────────────────────────────────────────────────
import {
    getStockHandler,
    getSuppliersHandler,
    createSupplier,
    upsertSupplierPriceHandler,
    syncPurchasesHandler,
    transferStockHandler
} from '../helpers/admin-inventory.helper.js';

// ── COCINA ────────────────────────────────────────────────────
import {
    getRecipesHandler,
    getIngredientsHandler,
    addRecipeItemHandler,
    updateTechSheetHandler,
    getKdsItems,
    setPreparingHandler,
    setReadyHandler
} from '../helpers/kitchen.helper.js';

// ── MESEROS ───────────────────────────────────────────────────
import {
    getWaiterLayout,
    openTableHandler,
    closeTableHandler,
    submitOrderHandler,
    deliverItemHandler
} from '../helpers/waiter.helper.js';

// ── CAJA ─────────────────────────────────────────────────────
import {
    getBoard,
    getCorte,
    getEmployees,
    submitPayment,
    requestInvoice          // ← NUEVO (crítico #3)
} from '../helpers/cashier.helper.js';

// ── AUTH ──────────────────────────────────────────────────────
import {
    loginHandler,
    validatePinHandler
} from '../helpers/auth.helper.js';


// ============================================================
// MAPA CENTRAL
// ============================================================
export const handlerRegistry = {

    // Auth
    login: loginHandler,
    validatePin: validatePinHandler,

    // Empleados
    syncHrCatalogs,
    saveEmployee,
    updateEmployee,
    deactivateEmployee: deactivateEmployeeData,
    createArea,
    updateArea,
    deactivateArea,
    bulkDeactivateAreas,
    createJobTitle,
    updateJobTitle,
    deactivateJobTitle,
    bulkDeactivateJobTitles,

    // Layout
    getFloorLayout,
    createZone: saveZone,
    updateZone: updateZoneHandler,
    deleteZone: deleteZoneHandler,
    createTable: saveTable,
    updateTable: updateTableHandler,
    deleteTable: deleteTableHandler,
    createAssignmentRange: createAssignmentRangeHandler,
    deleteAssignment: deleteAssignmentHandler,

    // Menú
    getMenuDishes,
    createCategory: createCategoryHandler,
    updateCategory: updateCategoryHandler,
    deleteCategory: deleteCategoryHandler,
    createDish: createDishHandler,
    updateDish: updateDishHandler,
    deleteDish: deleteDishHandler,

    // Inventario
    getStock: getStockHandler,
    getSuppliers: getSuppliersHandler,
    createSupplier: createSupplier,
    upsertSupplierPrice: upsertSupplierPriceHandler,
    syncPurchases: syncPurchasesHandler,
    transferStock: transferStockHandler,

    // Cocina / KDS
    getRecipes: getRecipesHandler,
    getIngredients: getIngredientsHandler,
    addRecipeItem: addRecipeItemHandler,
    updateTechSheet: updateTechSheetHandler,
    getKdsItems,
    setItemPreparing: setPreparingHandler,
    setItemReady: setReadyHandler,

    // Meseros
    getWaiterLayout,
    openTable: openTableHandler,
    closeTable: closeTableHandler,
    submitOrder: submitOrderHandler,
    deliverItem: deliverItemHandler,

    // Caja
    getCashierBoard: getBoard,
    getCashierCorte: getCorte,
    getCashierEmployees: getEmployees,
    processPayment: submitPayment,
    requestInvoice                          // ← NUEVO (crítico #3)
};
