// frontends/core/js/kore.config.js

const currentHost = window.location.hostname;

const BASE_DOMAIN = currentHost.split('.').length > 1 && !currentHost.match(/^\d/)
    ? currentHost.substring(currentHost.indexOf('.') + 1)
    : currentHost;

const IS_DEV = currentHost.includes('localhost') || currentHost === '127.0.0.1';

export const KORE_CONFIG = {

    ENV:   IS_DEV ? 'development' : 'production',
    DEBUG: IS_DEV,

    API: {
        BASE_URL: `http://api.${BASE_DOMAIN}/api`
    },

    // ── Registro de micrositios ──────────────────────────────────────────────
    SITES: {
        ADMIN:    { enabled: true,  host: `admin.${BASE_DOMAIN}`   },
        CASHIER:  { enabled: true,  host: `cashier.${BASE_DOMAIN}` },
        KITCHEN:  { enabled: true,  host: `kitchen.${BASE_DOMAIN}` },
        MENU:     { enabled: true,  host: `menu.${BASE_DOMAIN}`    },
        WAITERS:  { enabled: true,  host: `waiters.${BASE_DOMAIN}` },
        INVOICE:  { enabled: false, host: `invoice.${BASE_DOMAIN}` },
        API_DOCS: { enabled: true,  host: `api.${BASE_DOMAIN}/api/docs` }
    },

    // ── Diccionario del DOM ──────────────────────────────────────────────────
    // Fuente de verdad para IDs de containers y nombres de templates.
    // Prohibido escribir estos strings directamente en los controladores.
    DOM: {

        // ── Admin (admin.localhost) ──────────────────────────────────────────
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
                ROOT:    '#app-root',
                SIDEBAR: '#sidebar-container'
            },
            TEMPLATES: {
                SIDEBAR:    'tpl-sidebar',
                DASHBOARD:  'tpl-admin-dashboard',
                PISO:       'tpl-admin-piso',
                EMPLEADOS:  'tpl-admin-empleados',
                WIP:        'tpl-en-construccion',
                MENU:       'tpl-admin-menu',
                INVENTARIO: 'tpl-admin-inventario'
            }
        },

        // ── Caja (cashier.localhost) ─────────────────────────────────────────
        // ⚠️  NOTA: Este módulo usa innerHTML + template literals en view.js
        // en lugar del patrón <template> + TemplateLoader.
        // Migración planificada. Ver: 05_guia_creacion_vistas_frontend.md §1
        CASHIER: {
            PARTIALS: [
                '_login.html',    // tpl-cashier-login | tpl-cashier-emp-option | tpl-cashier-pin-btn
                '_board.html',    // tpl-cashier-board | tpl-cashier-board-item | tpl-cashier-board-empty
                '_detail.html',   // tpl-cashier-detail | tpl-cashier-detail-row | tpl-cashier-detail-loading
                '_payment.html',  // tpl-cashier-payment | tpl-cashier-pay-line | tpl-cashier-ticket
                '_corte.html'     // tpl-cashier-corte | tpl-cashier-corte-row | tpl-cashier-corte-empty
            ],
            CONTAINERS: {
                ROOT: '#app'
            },
            TEMPLATES: {
                LOGIN:          'tpl-cashier-login',
                EMP_OPTION:     'tpl-cashier-emp-option',
                PIN_BTN:        'tpl-cashier-pin-btn',
                BOARD:          'tpl-cashier-board',
                BOARD_ITEM:     'tpl-cashier-board-item',
                BOARD_EMPTY:    'tpl-cashier-board-empty',
                DETAIL:         'tpl-cashier-detail',
                DETAIL_ROW:     'tpl-cashier-detail-row',
                DETAIL_LOADING: 'tpl-cashier-detail-loading',
                PAYMENT:        'tpl-cashier-payment',
                PAY_LINE:       'tpl-cashier-pay-line',
                TICKET:         'tpl-cashier-ticket',
                CORTE:          'tpl-cashier-corte',
                CORTE_ROW:      'tpl-cashier-corte-row',
                CORTE_EMPTY:    'tpl-cashier-corte-empty'
            }
        },

        // ── Cocina (kitchen.localhost) ───────────────────────────────────────
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
                KDS:        'tpl-kitchen-kds',
                RECETAS:    'tpl-kitchen-recetas',
                INVENTARIO: 'tpl-kitchen-inventario',
                MODAL_PIN:  'tpl-kitchen-modal-pin'
            }
        },

        // -- Facturacion (invoice.localhost) --
        INVOICE: {
            PARTIALS: [
                '_search.html',  // tpl-invoice-search
                '_form.html',    // tpl-invoice-form | tpl-invoice-item-row | tpl-invoice-already-invoiced
                '_done.html'     // tpl-invoice-done
            ],
            CONTAINERS: {
                ROOT: '#app'
            },
            TEMPLATES: {
                SEARCH:           'tpl-invoice-search',
                FORM:             'tpl-invoice-form',
                ITEM_ROW:         'tpl-invoice-item-row',
                ALREADY_INVOICED: 'tpl-invoice-already-invoiced',
                DONE:             'tpl-invoice-done'
            }
        }

        // WAITERS, MENU: pendientes de definir cuando se construyan
    }
};
