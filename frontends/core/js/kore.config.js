// frontends/core/js/kore.config.js

const currentHost = window.location.hostname;

const getBaseDomain = (currentHost) => {
    // Caso 1: Eliminar puerto si existe (ej: localhost:3000)
    const hostWithoutPort = currentHost.split(':')[0];
    const parts = hostWithoutPort.split('.');

    // Caso 2: Detectar entornos de desarrollo
    const isLocalDev = hostWithoutPort === 'localhost' ||
        hostWithoutPort === '127.0.0.1' ||
        hostWithoutPort.match(/^(\d{1,3}\.){3}\d{1,3}$/); // IP

    if (isLocalDev) {
        return hostWithoutPort;
    }

    // Caso 3: admin.localhost, api.admin.localhost -> localhost (desarrollo con subdominio)
    if (hostWithoutPort.endsWith('localhost')) {
        return 'localhost';
    }

    // Caso 4: Para IPs con subdominio (ej: admin.127.0.0.1)
    if (hostWithoutPort.match(/^\d/)) {
        const ipMatch = hostWithoutPort.match(/(\d{1,3}\.){3}\d{1,3}$/);
        if (ipMatch) {
            return ipMatch[0];
        }
        return hostWithoutPort;
    }

    // Caso 5: Dominios con subdominio (ej: admin.kore.bar -> kore.bar)
    if (parts.length > 2) {
        // Tomar los últimos 2 segmentos como dominio base
        // Esto funciona para: kore.bar, techic.agency, dominio.com, etc.
        return parts.slice(-2).join('.');
    }

    // Caso 6: Sin subdominio (ej: kore.bar -> kore.bar)
    return hostWithoutPort;
};

const BASE_DOMAIN = getBaseDomain(currentHost);

const IS_DEV = currentHost.includes('localhost') || currentHost === '127.0.0.1';
const PROTOCOL = IS_DEV ? 'http' : 'https';

export const KORE_CONFIG = {

    BASE_DOMAIN: BASE_DOMAIN,
    PROTOCOL: PROTOCOL,

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
        DOCS: { enabled: true, url: 'https://github.com/a81Biz/kore-bar/tree/main/docs', external: true },
        GITHUB: { enabled: true, url: 'https://github.com/a81Biz/kore-bar', external: true },
        JIRA: { enabled: true, url: 'https://a81biz.github.io/kore-bar/', external: true }
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
                '_turnos.html',
                '_horarios.html',
                'reportes.html'
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
                TURNOS: 'tpl-admin-turnos',
                HORARIOS: 'tpl-admin-horarios',
                REPORTES: 'tpl-reportes'
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