// shared/js/endpoints.js
// Fuente única de verdad para todas las rutas HTTP del sistema.
// Los tokens :param son reemplazados dinámicamente por http.client.js → buildUrl().

export const ENDPOINTS = {

    // ──────────────────────────────────────────────────────────────────────────
    // MESEROS (waiters.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    waiters: {
        get: {
            waiters: '/waiters',
            layout: '/waiters/layout',
            orderStatus: '/waiters/tables/:tableCode/order',
            floorStock: '/waiters/floor-stock'
        },
        post: {
            login: '/waiters/login',
            openTable: '/waiters/tables/:tableCode/open',
            orders: '/waiters/tables/:tableCode/orders',
            closeTable: '/waiters/tables/:tableCode/close'
        },
        put: {
            collectItem: '/waiters/tables/:tableCode/items/:itemId/collect',
            deliverItem: '/waiters/tables/:tableCode/items/:itemId/deliver'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // ADMINISTRACIÓN (admin.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    admin: {
        get: {
            employees: '/admin/employees',
            areas: '/admin/employees/areas',
            jobTitles: '/admin/employees/job-titles',
            zones: '/admin/zones',
            tables: '/admin/tables',
            assignments: '/admin/assignments',
            menuCategories: '/admin/menu/categories',
            menuDishes: '/admin/menu/dishes',
            // Turnos y Asistencia
            shifts: '/admin/shifts',
            attendance: '/admin/attendance',
            schedules: '/admin/schedules',
            purchaseSuggestions: '/inventory/purchase-suggestions',
            absences: '/admin/attendance/absences',
            payrollHistory: '/admin/attendance/payroll',
            payrollExport: '/admin/attendance/payroll/export',
        },
        post: {
            zone: '/admin/zones',
            table: '/admin/tables',
            assignment: '/admin/assignments',
            employee: '/admin/employees',
            webhook: '/admin/employees/webhook',
            bulkEmployees: '/admin/employees/bulk',
            syncCatalogs: '/admin/employees/sync-catalogs',
            bulkDeactivateAreas: '/admin/employees/areas/bulk-deactivate',
            bulkDeactivateJobTitles: '/admin/employees/job-titles/bulk-deactivate',
            menuCategory: '/admin/menu/categories',
            menuDish: '/admin/menu/dishes',
            // Turnos
            shift: '/admin/shifts',
            schedule: '/admin/schedules',
            generatePurchaseSuggestions: '/inventory/purchase-suggestions/generate',
            adminCheckin: '/admin/attendance/checkin',

            deduction: '/admin/attendance/deductions',
        },
        put: {
            employee: '/admin/employees/:id',
            bulkAreas: '/admin/employees/areas/bulk',
            bulkJobTitles: '/admin/employees/job-titles/bulk',
            menuDish: '/admin/menu/dishes/:code',
            // Seguridad
            resetPin: '/admin/employees/:employeeNumber/reset-pin',
            area: '/admin/employees/areas/:code',
        },
        delete: {
            employee: '/admin/employees/:id',
            area: '/admin/employees/areas/:code',
            jobTitle: '/admin/employees/job-titles/:code',
            zone: '/admin/zones/:code',
            table: '/admin/tables/:id',
            assignment: '/admin/assignments/:id',
            menuCategory: '/admin/menu/categories/:code',
            menuDish: '/admin/menu/dishes/:code',
            schedule: '/admin/schedules/:id',
            deduction: '/admin/attendance/deductions/:id',
        },
        patch: {
            sendPurchaseOrder: '/inventory/purchase-orders/:id/send'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // CAJA (cashier.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    cashier: {
        get: {
            employees: '/admin/cashier/employees',
            board: '/admin/cashier/board',
            corte: '/admin/cashier/corte',
            ticket: '/admin/cashier/tickets/:folio'
        },
        post: {
            login: '/admin/cashier/login',
            pay: '/admin/cashier/tables/:tableCode/pay'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // FACTURACIÓN (invoice.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    invoice: {
        post: {
            request: '/admin/cashier/tickets/:folio/invoice'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // COCINA (kitchen.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    kitchen: {
        get: {
            board: '/kitchen/board',
            pendingDishes: '/kitchen/dishes/pending',
            finishedDishes: '/kitchen/dishes/finished',
            ingredients: '/kitchen/ingredients',
            recipeBOM: '/kitchen/recipes/:dishCode/bom',
            kitchenStock: '/inventory/stock?location=LOC-COCINA'

        },
        post: {
            ingredient: '/kitchen/ingredients',
            recipeItem: '/kitchen/recipes/items',
            clockIn: '/admin/auth/login'
        },
        put: {
            itemStatus: '/kitchen/items/:itemId/status',
            techSheet: '/kitchen/recipes/:dishCode/tech-sheet'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // INVENTARIO (admin.localhost — sub-módulo)
    // ──────────────────────────────────────────────────────────────────────────
    inventory: {
        get: {
            suppliers: '/inventory/suppliers',
            stock: '/inventory/stock',
            // Stock de piso referenciado únicamente desde admin-inventario.
            // El micrositio de meseros usa ENDPOINTS.waiters.get.floorStock.
            floorStock: '/inventory/stock?location=LOC-PISO',
            kardex: '/inventory/kardex'
        },
        post: {
            suppliers: '/inventory/suppliers',
            supplierPrices: '/inventory/suppliers/prices',
            transfers: '/inventory/transfers',
            adjustments: '/inventory/adjustments',
            sync: '/inventory/sync'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // MENÚ DIGITAL (menu.localhost — portal público de QR, sin autenticación)
    // ──────────────────────────────────────────────────────────────────────────
    menu: {
        get: {
            public: '/menu/public'
        },
        post: {
            callWaiter: '/tables/:tableCode/call-waiter'
        }
    }

};