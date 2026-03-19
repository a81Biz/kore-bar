import { KORE_CONFIG } from './kore.config.js';

export const KoreCore = {

    // 🟢 NUEVO: El Interceptor de Consola
    setupLogger() {
        if (!KORE_CONFIG.DEBUG) {
            // Si estamos en Producción, vaciamos las funciones de la consola.
            // Actuarán como "Agujeros Negros" absorbiendo los logs sin gastar memoria.
            console.log = () => { };
            console.info = () => { };
            console.debug = () => { };
            console.warn = () => { };
            // ⚠️ Mantenemos console.error intacto por si ocurre un fallo crítico (ej. caída de red)
        } else {
            console.log('%c[Kore OS] Entorno de Desarrollo (DEBUG MODE)', 'color: #10b981; font-weight: bold; border: 1px solid #10b981; padding: 2px 6px; border-radius: 4px;');
        }
    },

    boot() {
        // 🟢 NUEVO: Arrancamos el silenciador antes que cualquier otra cosa
        this.setupLogger();

        console.log('🚀 Iniciando Kore Bar OS Core Engine...');
        const currentHost = window.location.hostname;

        // 1. Validar si estamos en el Portal Raíz
        if (currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost.split('.').length === 1 || currentHost === KORE_CONFIG.BASE_DOMAIN) {
            console.log('[Core] Montando Portal de Tesis...');

            // Hidratar los enlaces dinámicamente desde el diccionario
            Object.keys(KORE_CONFIG.SITES).forEach(siteKey => {
                const btn = document.querySelector(`a[data-site="${siteKey}"]`);
                if (btn) {
                    const siteConfig = KORE_CONFIG.SITES[siteKey];
                    const protocol = window.location.protocol;

                    btn.href = `${protocol}//${siteConfig.host}`;

                    if (!siteConfig.enabled) {
                        btn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-200');
                        btn.classList.remove('hover:bg-indigo-600', 'hover:bg-slate-200', 'bg-slate-900');
                        btn.textContent = '';
                        const iconSpan = document.createElement('span');
                        iconSpan.className = 'material-symbols-outlined text-[18px] align-middle';
                        iconSpan.textContent = 'lock';
                        btn.appendChild(iconSpan);
                        btn.appendChild(document.createTextNode(' Apagado'));
                        btn.onclick = (e) => e.preventDefault();
                    }
                }
            });
            return;
        }

        // 2. Búsqueda Dinámica (Detecta en qué host estamos parados)
        const siteKey = Object.keys(KORE_CONFIG.SITES).find(
            key => currentHost.includes(KORE_CONFIG.SITES[key].host)
        );

        if (siteKey) {
            const site = KORE_CONFIG.SITES[siteKey];

            if (site.enabled) {
                console.log(`[Core] Inyectando subsistema: ${siteKey}`);
                import('/js/app.js').catch(err => {
                    console.error(`Error crítico cargando ${siteKey}:`, err);
                });
            } else {
                console.warn(`[Core] Subsistema ${siteKey} está apagado.`);
                this.renderOffline(currentHost);
            }
        } else {
            console.error(`[Core] Host desconocido: ${currentHost}`);
            this.renderOffline(currentHost);
        }
    },

    renderOffline(host) {
        document.body.innerHTML = ''; // Limpiar el body, pero no armar strings HTML grandes
        
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; height:100vh; width:100vw; align-items:center; justify-content:center; background:#f8fafc; font-family:sans-serif;';
        
        const card = document.createElement('div');
        card.style.cssText = 'text-align:center; padding: 2rem; border-radius: 1rem; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);';
        
        const iconContainer = document.createElement('span');
        iconContainer.style.cssText = 'font-size: 3rem; margin-bottom: 1rem; display:block;';
        iconContainer.textContent = '🚧';
        
        const title = document.createElement('h1');
        title.style.cssText = 'color:#334155; font-size:1.5rem; margin-bottom:0.5rem; font-weight:bold;';
        title.textContent = 'Micrositio Fuera de Línea';
        
        const message = document.createElement('p');
        message.style.cssText = 'color:#64748b;';
        message.appendChild(document.createTextNode('El entorno '));
        
        const boldHost = document.createElement('b');
        boldHost.textContent = host;
        message.appendChild(boldHost);
        message.appendChild(document.createTextNode(' está desactivado o no existe.'));
        
        card.appendChild(iconContainer);
        card.appendChild(title);
        card.appendChild(message);
        
        container.appendChild(card);
        document.body.appendChild(container);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    KoreCore.boot();
});