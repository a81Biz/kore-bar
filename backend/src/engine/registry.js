import * as AdminEmployee from '../helpers/admin-employee.helper.js';
import * as FloorHelpers from '../helpers/admin-floor.helper.js';
import * as MenuHelpers from '../helpers/admin-menu.helper.js';
import * as KitchenHelpers from '../helpers/kitchen.helper.js';
import * as InventoryHelpers from '../helpers/admin-inventory.helper.js';
import * as InventoryTransferHelpers from '../helpers/inventory-transfers.helper.js';
import * as PublicMenuHelpers from '../helpers/public-menu.helper.js';
import * as WaiterHelpers from '../helpers/waiter.helper.js';
import * as CashierHelpers from '../helpers/cashier.helper.js';

/**
 * Dummy handler for validation.
 * @param {Object} state - The workflow current state
 * @param {Object} context - The Hono context object
 */
const validateData = async (state, context) => {
    console.log('[Registry] Executing validateData...');
    state.isValidated = true;
    state.validationTime = new Date().toISOString();
};

/**
 * Dummy handler for making decisions. MUST return boolean.
 * @param {Object} state - The workflow current state
 * @param {Object} context - The Hono context object
 * @returns {Promise<boolean>}
 */
const checkCondition = async (state, context) => {
    console.log('[Registry] Executing checkCondition...');

    // Example logic: if state carries a forcing flag, use it, otherwise true
    if (typeof state.forcePass === 'boolean') {
        return state.forcePass;
    }
    return true;
};

/**
 * Dummy handler for finalizing the workflow step.
 * @param {Object} state - The workflow current state
 * @param {Object} context - The Hono context object
 */
const finalize = async (state, context) => {
    console.log('[Registry] Executing finalize...');
    state.isFinalized = true;
    state.status = 'COMPLETED';
};

/**
 * The ActionRegistry maps the string identifiers from JSON schemas
 * directly to the executable Javascript functions defined above.
 */
export const ActionRegistry = {
    "validateData": validateData,
    "checkCondition": checkCondition,
    "finalize": finalize,
    "validateWaiterPin": WaiterHelpers.validateWaiterPin,
    "getWaiterLayout": WaiterHelpers.getWaiterLayout,
    "openTable": WaiterHelpers.openTable,
    "submitOrder": WaiterHelpers.submitOrder,
    "waiterCollectItem": WaiterHelpers.waiterCollectItem,
    "waiterDeliverItem": WaiterHelpers.waiterDeliverItem,
    "getWaiterOrderStatus": WaiterHelpers.getWaiterOrderStatus,
    "closeTable": WaiterHelpers.closeTable,
    "syncHrCatalogs": AdminEmployee.syncHrCatalogs,
    "saveEmployee": AdminEmployee.saveEmployee,
    "getEmployees": AdminEmployee.getEmployees,
    "validateEmployeeExists": AdminEmployee.validateEmployeeExists,
    "deactivateEmployeeData": AdminEmployee.deactivateEmployeeData,
    "processHrWebhook": AdminEmployee.processHrWebhook,
    "getAreas": AdminEmployee.getAreas,
    "getJobTitles": AdminEmployee.getJobTitles,
    "updateArea": AdminEmployee.updateArea,
    "deactivateArea": AdminEmployee.deactivateArea,
    "updateJobTitle": AdminEmployee.updateJobTitle,
    "deactivateJobTitle": AdminEmployee.deactivateJobTitle,
    "bulkSaveEmployees": AdminEmployee.bulkSaveEmployees,
    "createArea": AdminEmployee.createArea,
    "bulkUpdateAreas": AdminEmployee.bulkUpdateAreas,
    "bulkDeactivateAreas": AdminEmployee.bulkDeactivateAreas,
    "createJobTitle": AdminEmployee.createJobTitle,
    "bulkUpdateJobTitles": AdminEmployee.bulkUpdateJobTitles,
    "bulkDeactivateJobTitles": AdminEmployee.bulkDeactivateJobTitles,
    "updateEmployee": AdminEmployee.updateEmployee,
    "saveZone": FloorHelpers.saveZone,
    "updateZone": FloorHelpers.updateZone,
    "getZones": FloorHelpers.getZones,
    "deleteZone": FloorHelpers.deleteZone,
    "saveTable": FloorHelpers.saveTable,
    "updateTable": FloorHelpers.updateTable,
    "getTables": FloorHelpers.getTables,
    "deleteTable": FloorHelpers.deleteTable,
    "saveAssignment": FloorHelpers.saveAssignment,
    "getAssignments": FloorHelpers.getAssignments,
    "deleteAssignment": FloorHelpers.deleteAssignment,
    "saveCategory": MenuHelpers.saveCategory,
    "updateCategory": MenuHelpers.updateCategory,
    "getCategories": MenuHelpers.getCategories,
    "deleteCategory": MenuHelpers.deleteCategory,
    "saveDish": MenuHelpers.saveDish,
    "updateDish": MenuHelpers.updateDish,
    "getDishes": MenuHelpers.getDishes,
    "deleteDish": MenuHelpers.deleteDish,
    "getPendingDishes": KitchenHelpers.getPendingDishes,
    "getKitchenBoard": KitchenHelpers.getKitchenBoard,
    "updateKitchenItemStatus": KitchenHelpers.updateKitchenItemStatus,
    "createIngredient": KitchenHelpers.createIngredient,
    "getIngredients": KitchenHelpers.getIngredients,
    "addRecipeItem": KitchenHelpers.addRecipeItem,
    "getFinishedDishes": KitchenHelpers.getFinishedDishes,
    "getRecipeBOM": KitchenHelpers.getRecipeBOM,
    "updateTechSheet": KitchenHelpers.updateTechSheet,
    "getSuppliers": InventoryHelpers.getSuppliers,
    "createSupplier": InventoryHelpers.createSupplier,
    "getInventoryStock": InventoryHelpers.getInventoryStock,
    "getKardex": InventoryHelpers.getKardex,
    "saveSupplierPrice": InventoryHelpers.saveSupplierPrice,
    "saveKardexTransfer": InventoryTransferHelpers.saveKardexTransfer,
    "syncPurchasesToKardex": InventoryTransferHelpers.syncPurchasesToKardex,
    "saveKardexAdjustment": InventoryTransferHelpers.saveKardexAdjustment,
    "getPublicMenu": PublicMenuHelpers.getPublicMenu,
    "registerWaiterCall": PublicMenuHelpers.registerWaiterCall,
    "getCashierEmployees": CashierHelpers.getCashierEmployees,
    "validateCashierPin": CashierHelpers.validateCashierPin,
    "getCashierBoard": CashierHelpers.getCashierBoard,
    "processPayment": CashierHelpers.processPayment,
    "getTicketByFolio": CashierHelpers.getTicketByFolio,
    "getCashierCorte": CashierHelpers.getCashierCorte
};
