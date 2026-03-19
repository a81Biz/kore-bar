// shared/js/endpoints.js

export const ENDPOINTS = {
    // ----------------------------------------------------
    // 1. MÓDULOS ORIGINALES (Gestión de Piso, Cajas, Meseros)
    // ----------------------------------------------------
    orders: {
        post: { create: '/orders' }
    },
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

    // ----------------------------------------------------
    // 2. MÓDULO DE ADMINISTRACIÓN (admin.localhost)
    // ----------------------------------------------------
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
    kitchen: {
        get: {
            board: '/kitchen/board',
            pendingDishes: '/kitchen/dishes/pending',
            ingredients: '/kitchen/ingredients',
            finishedDishes: '/kitchen/dishes/finished',
            recipeBOM: '/kitchen/recipes/:dishCode/bom'
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
    inventory: {
        get: {
            suppliers: '/inventory/suppliers',
            stock: '/inventory/stock',
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
};