// shared/js/endpoints.js
// Fuente única de verdad para todas las rutas HTTP del sistema.
// Los tokens :param son reemplazados dinámicamente por http.client.js → buildUrl().

export const ENDPOINTS = {

    // ──────────────────────────────────────────────────────────────────────────
    // MESEROS (waiters.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    waiters: {
        get: {
            layout: '/waiters/layout',
            orderStatus: '/waiters/tables/:tableCode/order'
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
            menuDishes: '/admin/menu/dishes'
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
            menuDish: '/admin/menu/dishes'
        },
        put: {
            employee: '/admin/employees/:id',
            bulkAreas: '/admin/employees/areas/bulk',
            bulkJobTitles: '/admin/employees/job-titles/bulk',
            menuDish: '/admin/menu/dishes/:code'
        },
        delete: {
            employee: '/admin/employees/:id',
            area: '/admin/employees/areas/:code',
            jobTitle: '/admin/employees/job-titles/:code',
            zone: '/admin/zones/:code',
            table: '/admin/tables/:id',
            assignment: '/admin/assignments/:id',
            menuCategory: '/admin/menu/categories/:code',
            menuDish: '/admin/menu/dishes/:code'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // CAJA (cashier.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    cashier: {
        get: {
            // Lista de empleados con acceso a caja (can_access_cashier = true)
            employees: '/cashier/employees',
            // Tablero: mesas en AWAITING_PAYMENT
            board: '/cashier/board',
            // Resumen del día — Corte Z
            corte: '/cashier/corte',
            // Ticket por folio (también consumido por invoice.localhost)
            ticket: '/cashier/tickets/:folio'
        },
        post: {
            // Autenticar cajero con PIN
            login: '/cashier/login',
            // Procesar cobro mixto de una mesa → devuelve folio TKT-
            pay: '/cashier/tables/:tableCode/pay'
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // FACTURACION (invoice.localhost)
    invoice: {
        // GET /cashier/tickets/:folio se reutiliza desde ENDPOINTS.cashier.get.ticket
        post: {
            // Registrar solicitud de CFDI — guarda datos fiscales en invoice_data (JSONB)
            // Integracion con el PAC (timbrado SAT) queda como fase futura.
            request: '/cashier/tickets/:folio/invoice'
        }
    },

    // COCINA (kitchen.localhost)
    // ──────────────────────────────────────────────────────────────────────────
    kitchen: {
        get: {
            board: '/kitchen/board',
            pendingDishes: '/kitchen/dishes/pending',
            finishedDishes: '/kitchen/dishes/finished',
            ingredients: '/kitchen/ingredients',
            recipeBOM: '/kitchen/recipes/:dishCode/bom',
            // Stock filtrado por locacion de cocina
            kitchenStock: '/inventory/stock?location=LOC-COCINA'
        },
        post: {
            ingredient: '/kitchen/ingredients',
            recipeItem: '/kitchen/recipes/items'
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
            // Stock filtrado por locacion de piso (meseros) — query param incluida
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
    }
    ,

    // MENU DIGITAL (menu.localhost — portal público de QR, sin autenticación)
    menu: {
        get: {
            // Catálogo completo agrupado por categoría (solo platillos habilitados)
            public: '/menu/public'
        },
        post: {
            // Notificación al mesero desde la mesa del cliente
            callWaiter: '/tables/:tableCode/call-waiter'
        }
    }

};