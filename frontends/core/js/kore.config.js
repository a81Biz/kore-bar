// frontends/core/js/kore.config.js

const currentHost = window.location.hostname;

const parts = currentHost.split('.');

const BASE_DOMAIN = parts.length > 2 && !currentHost.match(/^\d/)
    ? parts.slice(1).join('.') // admin.kore.bar -> kore.bar
    : currentHost;             // kore.bar -> kore.bar / localhost -> localhost

const IS_DEV = currentHost.includes('localhost') || currentHost === '127.0.0.1';
const PROTOCOL = IS_DEV ? 'http' : 'https';
export const KORE_CONFIG = {

    BASE_DOMAIN: BASE_DOMAIN,

    ENV: IS_DEV ? 'development' : 'production',
    DEBUG: IS_DEV,

    API: {
        BASE_URL: `${PROTOCOL}://api.${BASE_DOMAIN}/api`
    },

    // ── Registro de micrositios ──────────────────────────────────────────────
    SITES: {
        PORTAL: { enabled: true, host: BASE_DOMAIN },
        ADMIN: { enabled: true, host: `admin.${BASE_DOMAIN}` },
        CASHIER: { enabled: true, host: `cashier.${BASE_DOMAIN}` },
        KITCHEN: { enabled: true, host: `kitchen.${BASE_DOMAIN}` },
        MENU: { enabled: true, host: `menu.${BASE_DOMAIN}` },
        WAITERS: { enabled: true, host: `waiters.${BASE_DOMAIN}` },
        INVOICE: { enabled: true, host: `invoice.${BASE_DOMAIN}` },
        API_DOCS: { enabled: true, host: `api.${BASE_DOMAIN}/api/docs` },
        DOCS: { enabled: true, url: 'https://kore.bar/docs', external: true },
        GITHUB: { enabled: true, url: 'https://github.com/a81Biz/kore-bar', external: true },
        JIRA: { enabled: true, url: 'https://a81biz.atlassian.net/jira/software/c/projects/SGRM/boards/140?atlOrigin=eyJpIjoiNmM3NWNlMGMyZjgxNDUwMWIxMzNkODgxOWUxZjBlZGQiLCJwIjoiaiJ9', external: true }
    },

    // ── Diccionario del DOM ──────────────────────────────────────────────────
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
                '_inventario.html',
                '_turnos.html'
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
                INVENTARIO: 'tpl-admin-inventario',
                TURNOS: 'tpl-admin-turnos'
            }
        },

        // ── Caja (cashier.localhost) ─────────────────────────────────────────
        CASHIER: {
            PARTIALS: [
                '_login.html',
                '_board.html',
                '_detail.html',
                '_payment.html',
                '_corte.html'
            ],
            CONTAINERS: {
                ROOT: '#app'
            },
            TEMPLATES: {
                LOGIN: 'tpl-cashier-login',
                EMP_OPTION: 'tpl-cashier-emp-option',
                PIN_BTN: 'tpl-cashier-pin-btn',
                BOARD: 'tpl-cashier-board',
                BOARD_ITEM: 'tpl-cashier-board-item',
                BOARD_EMPTY: 'tpl-cashier-board-empty',
                DETAIL: 'tpl-cashier-detail',
                DETAIL_ROW: 'tpl-cashier-detail-row',
                DETAIL_LOADING: 'tpl-cashier-detail-loading',
                PAYMENT: 'tpl-cashier-payment',
                PAY_LINE: 'tpl-cashier-pay-line',
                TICKET: 'tpl-cashier-ticket',
                CORTE: 'tpl-cashier-corte',
                CORTE_ROW: 'tpl-cashier-corte-row',
                CORTE_EMPTY: 'tpl-cashier-corte-empty'
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
                KDS: 'tpl-kitchen-kds',
                RECETAS: 'tpl-kitchen-recetas',
                INVENTARIO: 'tpl-kitchen-inventario',
                MODAL_PIN: 'tpl-kitchen-modal-pin'
            }
        },

        // ── Meseros (waiters.localhost) ──────────────────────────────────────
        // NOTA ARQUITECTÓNICA: Este micrositio NO usa TemplateLoader — los templates
        // están definidos inline en index.html. No requiere sección PARTIALS.
        // Desviación documentada: no usa kore.core.js (ver doc 07 §Desviaciones formales).
        WAITERS: {
            CONTAINERS: {
                ROOT: '#app-root'
            },
            TEMPLATES: {
                LOGIN: 'tpl-login',
                DASHBOARD: 'tpl-dashboard',
                ORDER: 'tpl-order'
            }
        },

        // ── Menú Digital (menu.localhost) ────────────────────────────────────
        // NOTA ARQUITECTÓNICA: Micrositio público de solo lectura.
        // No usa kore.core.js ni TemplateLoader. Arranque directo vía menu.js.
        // Desviación documentada (ver doc 07 §Desviaciones formales).
        MENU: {
            CONTAINERS: {
                ROOT: '#menuContainer'
            }
        },

        // ── Facturacion (invoice.localhost) ──────────────────────────────────
        INVOICE: {
            PARTIALS: [
                '_search.html',
                '_form.html',
                '_done.html'
            ],
            CONTAINERS: {
                ROOT: '#app'
            },
            TEMPLATES: {
                SEARCH: 'tpl-invoice-search',
                FORM: 'tpl-invoice-form',
                ITEM_ROW: 'tpl-invoice-item-row',
                ALREADY_INVOICED: 'tpl-invoice-already-invoiced',
                DONE: 'tpl-invoice-done'
            }
        }
    }
};