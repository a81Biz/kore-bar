// ============================================================
// schema-registry.js
// Índice estático de todos los schemas JSON del Workflow Engine.
//
// Node 20 + esbuild (Workers): todos los imports JSON necesitan
//   assert { type: 'json' }
// esbuild los incrusta en el bundle en compilación → no hay fs en runtime.
// ============================================================

// ── ADMIN / ASSIGNMENT ────────────────────────────────────────
import createAssignment from './schemas/admin/assignment/create-assignment.schema.json'       assert { type: 'json' };
import deleteAssignment from './schemas/admin/assignment/delete-assignment.schema.json'       assert { type: 'json' };
import getAssignment from './schemas/admin/assignment/get-assignment.schema.json'          assert { type: 'json' };

// ── ADMIN / AUTH ──────────────────────────────────────────────
import loginHandler from './schemas/admin/auth/auth-login.schema.json'                   assert { type: 'json' };
import authPin from './schemas/admin/auth/auth-pin.schema.json'                     assert { type: 'json' };

// ── ADMIN / ATTENDANCE ──────────────────────────────────────────────

import createPayrollDeduction from './schemas/admin/attendance/create-payroll-deduction.schema.json' assert { type: 'json'};
import deletePayrollDeduction from './schemas/admin/attendance/delete-payroll-deduction.schema.json' assert { type: 'json'};
import exportPayrollData from './schemas/admin/attendance/get-payroll-export.schema.json' assert { type: 'json'};
import getPayrollHistory from './schemas/admin/attendance/get-payroll-history.schema.json' assert { type: 'json'};
import recordAdminCheckin from './schemas/admin/attendance/record-attendance-admin.schema.json' assert { type: 'json'};

// ── ADMIN / CASHIER ───────────────────────────────────────────
import cashierBoard from './schemas/admin/cashier/cashier-board.schema.json'             assert { type: 'json' };
import cashierCorte from './schemas/admin/cashier/cashier-corte.schema.json'             assert { type: 'json' };
import cashierEmployees from './schemas/admin/cashier/cashier-employees.schema.json'         assert { type: 'json' };
import cashierGetTicket from './schemas/admin/cashier/cashier-get-ticket.schema.json'        assert { type: 'json' };
import cashierInvoiceRequest from './schemas/admin/cashier/cashier-invoice-request.schema.json'   assert { type: 'json' };
import cashierLogin from './schemas/admin/cashier/cashier-login.schema.json'             assert { type: 'json' };
import cashierProcessPayment from './schemas/admin/cashier/cashier-process-payment.schema.json'   assert { type: 'json' };

// ── ADMIN / CATALOGS ──────────────────────────────────────────
import bulkDeactivateAreas from './schemas/admin/catalogs/bulk-deactivate-areas.schema.json'      assert { type: 'json' };
import bulkDeactivateJobTitles from './schemas/admin/catalogs/bulk-deactivate-job-titles.schema.json' assert { type: 'json' };
import bulkUpdateAreas from './schemas/admin/catalogs/bulk-update-areas.schema.json'          assert { type: 'json' };
import bulkUpdateJobTitles from './schemas/admin/catalogs/bulk-update-job-titles.schema.json'     assert { type: 'json' };
import createArea from './schemas/admin/catalogs/create-area.schema.json'                assert { type: 'json' };
import createJobTitle from './schemas/admin/catalogs/create-job-title.schema.json'           assert { type: 'json' };
import deactivateArea from './schemas/admin/catalogs/deactivate-area.schema.json'            assert { type: 'json' };
import deactivateJobTitle from './schemas/admin/catalogs/deactivate-job-title.schema.json'       assert { type: 'json' };
import getAreas from './schemas/admin/catalogs/get-areas.schema.json'                  assert { type: 'json' };
import getJobTitles from './schemas/admin/catalogs/get-job-titles.schema.json'             assert { type: 'json' };
import updateArea from './schemas/admin/catalogs/update-area.schema.json'                assert { type: 'json' };
import updateJobTitle from './schemas/admin/catalogs/update-job-title.schema.json'           assert { type: 'json' };

// ── ADMIN / EMPLOYEE ──────────────────────────────────────────
import bulkEmployees from './schemas/admin/employee/bulk-employees.schema.json'        assert { type: 'json' };
import createEmployee from './schemas/admin/employee/create-employee.schema.json'       assert { type: 'json' };
import createShift from './schemas/admin/employee/create-shift.schema.json'          assert { type: 'json' };
import deactivateEmployee from './schemas/admin/employee/deactivate-employee.schema.json'   assert { type: 'json' };
import getAttendance from './schemas/admin/employee/get-attendance.schema.json'        assert { type: 'json' };
import getEmployees from './schemas/admin/employee/get-employees.schema.json'         assert { type: 'json' };
import getShifts from './schemas/admin/employee/get-shifts.schema.json'            assert { type: 'json' };
import hrWebhook from './schemas/admin/employee/hr-webhook.schema.json'            assert { type: 'json' };
import resetEmployeePin from './schemas/admin/employee/reset-employee-pin.schema.json'    assert { type: 'json' };
import syncCatalogs from './schemas/admin/employee/sync-catalogs.schema.json'         assert { type: 'json' };
import updateEmployee from './schemas/admin/employee/update-employee.schema.json'       assert { type: 'json' };
import createSchedule from './schemas/admin/employee/create-schedule.schema.json'  assert { type: 'json' };
import getSchedules from './schemas/admin/employee/get-schedules.schema.json'     assert { type: 'json' };
import deleteSchedule from './schemas/admin/employee/delete-schedule.schema.json'  assert { type: 'json' };
import getAbsences from './schemas/admin/employee/get-absences.schema.json' assert { type: 'json' };

// ── ADMIN / MENU ──────────────────────────────────────────────
import createMenuCategory from './schemas/admin/menu/create-menu-category.schema.json'   assert { type: 'json' };
import createMenuDish from './schemas/admin/menu/create-menu-dish.schema.json'       assert { type: 'json' };
import deleteMenuCategory from './schemas/admin/menu/delete-menu-category.schema.json'   assert { type: 'json' };
import deleteMenuDish from './schemas/admin/menu/delete-menu-dish.schema.json'       assert { type: 'json' };
import getMenuCategories from './schemas/admin/menu/get-menu-categories.schema.json'    assert { type: 'json' };
import getMenuDishes from './schemas/admin/menu/get-menu-dishes.schema.json'        assert { type: 'json' };
import updateMenuCategory from './schemas/admin/menu/update-menu-category.schema.json'   assert { type: 'json' };
import updateMenuDish from './schemas/admin/menu/update-menu-dish.schema.json'       assert { type: 'json' };

// ── ADMIN / TABLES ────────────────────────────────────────────
import createTable from './schemas/admin/tables/create-table.schema.json'   assert { type: 'json' };
import deleteTable from './schemas/admin/tables/delete-table.schema.json'   assert { type: 'json' };
import getTables from './schemas/admin/tables/get-tables.schema.json'     assert { type: 'json' };
import updateTable from './schemas/admin/tables/update-table.schema.json'   assert { type: 'json' };

// ── ADMIN / ZONES ─────────────────────────────────────────────
import createZone from './schemas/admin/zones/create-zone.schema.json'   assert { type: 'json' };
import deleteZone from './schemas/admin/zones/delete-zone.schema.json'   assert { type: 'json' };
import getZones from './schemas/admin/zones/get-zones.schema.json'     assert { type: 'json' };
import updateZone from './schemas/admin/zones/update-zone.schema.json'   assert { type: 'json' };

// ── INVENTORY ─────────────────────────────────────────────────
import createAdjustment from './schemas/inventory/create-adjustment.schema.json'   assert { type: 'json' };
import createSupplier from './schemas/inventory/create-supplier.schema.json'     assert { type: 'json' };
import createTransfer from './schemas/inventory/create-transfer.schema.json'     assert { type: 'json' };
import getInventory from './schemas/inventory/get-inventory.schema.json'       assert { type: 'json' };
import getKardex from './schemas/inventory/get-kardex.schema.json'          assert { type: 'json' };
import getSuppliers from './schemas/inventory/get-suppliers.schema.json'       assert { type: 'json' };
import supplierPrice from './schemas/inventory/supplier-price.schema.json'      assert { type: 'json' };
import syncPurchases from './schemas/inventory/sync-purchases.schema.json'      assert { type: 'json' };
import webhookPurchase from './schemas/inventory/webhook-purchase.schema.json'    assert { type: 'json' };
import generatePurchaseSuggestions from './schemas/inventory/generate-purchase-suggestions.schema.json' assert { type: 'json' };
import getPurchaseSuggestions from './schemas/inventory/get-purchase-suggestions.schema.json' assert { type: 'json' };
import sendPurchaseOrder from './schemas/inventory/send-purchase-order.schema.json' assert { type: 'json' };

// ── KITCHEN / KDS ─────────────────────────────────────────────
import kitchenBoard from './schemas/kitchen/kds/kitchen-board.schema.json'        assert { type: 'json' };
import kitchenItemStatus from './schemas/kitchen/kds/kitchen-item-status.schema.json'  assert { type: 'json' };

// ── KITCHEN / RECIPES ─────────────────────────────────────────
import addRecipeItem from './schemas/kitchen/recipes/add-recipe-item.schema.json'      assert { type: 'json' };
import createIngredient from './schemas/kitchen/recipes/create-ingredient.schema.json'    assert { type: 'json' };
import getFinishedDishes from './schemas/kitchen/recipes/get-finished-dishes.schema.json'  assert { type: 'json' };
import getIngredients from './schemas/kitchen/recipes/get-ingredients.schema.json'      assert { type: 'json' };
import getPendingDishes from './schemas/kitchen/recipes/get-pending-dishes.schema.json'   assert { type: 'json' };
import getRecipeBom from './schemas/kitchen/recipes/get-recipe-bom.schema.json'       assert { type: 'json' };
import updateTechSheet from './schemas/kitchen/recipes/update-tech-sheet.schema.json'    assert { type: 'json' };

// ── PUBLIC / MENU ─────────────────────────────────────────────
import getMenuPublic from './schemas/public/menu/get-menu-public.schema.json'   assert { type: 'json' };

// ── PUBLIC / POS ──────────────────────────────────────────────
import getWaiter from './schemas/public/pos/get-waiter.schema.json'           assert { type: 'json' };
import waiterCloseTable from './schemas/public/pos/waiter-close-table.schema.json'   assert { type: 'json' };
import waiterCollectItem from './schemas/public/pos/waiter-collect-item.schema.json'  assert { type: 'json' };
import waiterDeliverItem from './schemas/public/pos/waiter-deliver-item.schema.json'  assert { type: 'json' };
import waiterFloorStock from './schemas/public/pos/waiter-floor-stock.schema.json'   assert { type: 'json' };
import waiterLayout from './schemas/public/pos/waiter-layout.schema.json'        assert { type: 'json' };
import waiterLogin from './schemas/public/pos/waiter-login.schema.json'         assert { type: 'json' };
import waiterOpenTable from './schemas/public/pos/waiter-open-table.schema.json'    assert { type: 'json' };
import waiterOrderStatus from './schemas/public/pos/waiter-order-status.schema.json'  assert { type: 'json' };
import waiterSubmitOrder from './schemas/public/pos/waiter-submit-order.schema.json'  assert { type: 'json' };

// ── PUBLIC / TABLES ───────────────────────────────────────────
import callWaiter from './schemas/public/tables/call-waiter.schema.json'   assert { type: 'json' };


// ============================================================
// REGISTRO CENTRAL organizado por subDir
// (subDir coincide con las claves de RouteRegistry)
// ============================================================
export const schemasBySubDir = {

    admin: [
        createAssignment, deleteAssignment, getAssignment,
        loginHandler, authPin,
        cashierBoard, cashierCorte, cashierEmployees, cashierGetTicket,
        cashierInvoiceRequest, cashierLogin, cashierProcessPayment,
        bulkDeactivateAreas, bulkDeactivateJobTitles,
        bulkUpdateAreas, bulkUpdateJobTitles,
        createArea, createJobTitle, deactivateArea, deactivateJobTitle,
        getAreas, getJobTitles, updateArea, updateJobTitle,
        bulkEmployees, createEmployee, createShift, deactivateEmployee,
        getAttendance, getEmployees, getShifts, hrWebhook,
        resetEmployeePin, syncCatalogs, updateEmployee,
        createMenuCategory, createMenuDish, deleteMenuCategory, deleteMenuDish,
        getMenuCategories, getMenuDishes, updateMenuCategory, updateMenuDish,
        createTable, deleteTable, getTables, updateTable,
        createZone, deleteZone, getZones, updateZone,
        createSchedule, getSchedules, deleteSchedule, getAbsences,
        createPayrollDeduction, deletePayrollDeduction, exportPayrollData,
        getPayrollHistory, recordAdminCheckin
    ],

    inventory: [
        createAdjustment, createSupplier, createTransfer,
        getInventory, getKardex, getSuppliers,
        supplierPrice, syncPurchases, webhookPurchase,
        generatePurchaseSuggestions, getPurchaseSuggestions, sendPurchaseOrder
    ],

    kitchen: [
        kitchenBoard, kitchenItemStatus,
        addRecipeItem, createIngredient, getFinishedDishes, getIngredients,
        getPendingDishes, getRecipeBom, updateTechSheet,
    ],

    public: [
        getMenuPublic,
        getWaiter, waiterCloseTable, waiterCollectItem, waiterDeliverItem,
        waiterFloorStock, waiterLayout, waiterLogin, waiterOpenTable,
        waiterOrderStatus, waiterSubmitOrder,
        callWaiter,
    ],
};

/**
 * Lista plana de todos los schemas con su subDir adjunto.
 * Útil para swagger.js.
 */
export const allSchemas = Object.entries(schemasBySubDir).flatMap(
    ([subDir, schemas]) => schemas.map(schema => ({ schema, subDir }))
);