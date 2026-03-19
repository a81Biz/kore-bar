
const currentHost = window.location.hostname;

const BASE_DOMAIN = currentHost.split('.').length > 1 && !currentHost.match(/^\d/)
    ? currentHost.substring(currentHost.indexOf('.') + 1)
    : currentHost;

const IS_DEV = currentHost.includes('localhost') || currentHost === '127.0.0.1';

export const KORE_CONFIG = {

    ENV: IS_DEV ? 'development' : 'production',
    DEBUG: IS_DEV,

    API: {
        BASE_URL: `http://api.${BASE_DOMAIN}/api` // En prod será https://api.korebar.com/api
    },

    // 2. Control de Micrositios dinámico
    SITES: {
        ADMIN: { enabled: true, host: `admin.${BASE_DOMAIN}` },
        CASHIER: { enabled: true, host: `cashier.${BASE_DOMAIN}` },
        KITCHEN: { enabled: true, host: `kitchen.${BASE_DOMAIN}` },
        MENU: { enabled: true, host: `menu.${BASE_DOMAIN}` },
        WAITERS: { enabled: true, host: `waiters.${BASE_DOMAIN}` },
        INVOICE: { enabled: true, host: `invoice.${BASE_DOMAIN}` },
        API_DOCS: { enabled: true, host: `api.${BASE_DOMAIN}/api/docs` }
    },

    // 3. Diccionario del DOM
    DOM: {
        ADMIN: {
            PARTIALS: [
                '_sidebar.html',
                '_dashboard.html',
                '_piso.html',
                '_empleados.html',
                '_modal_empleado.html',
                '_construccion.html',
                '_menu.html',
                '_inventario.html'
            ],
            CONTAINERS: {
                ROOT: '#app-root',
                SIDEBAR: '#sidebar-container'
            },
            TEMPLATES: {
                SIDEBAR: 'tpl-sidebar',
                DASHBOARD: 'tpl-admin-dashboard',
                PISO: 'tpl-admin-piso',
                EMPLEADOS: 'tpl-admin-empleados',
                WIP: 'tpl-en-construccion',
                MENU: 'tpl-admin-menu',
                INVENTARIO: 'tpl-admin-inventario'
            }
        },
        KITCHEN: {
            PARTIALS: [
                '_kds.html',
                '_recetas.html',
                '_inventario.html',
                '_modal_pin.html'
            ],
            CONTAINERS: {
                ROOT: '#app-root'
            },
            TEMPLATES: {
                KDS: 'tpl-kitchen-kds',
                RECETAS: 'tpl-kitchen-recetas',
                INVENTARIO: 'tpl-kitchen-inventario',
                MODAL_PIN: 'tpl-kitchen-modal-pin'
            }
        }
    }
};