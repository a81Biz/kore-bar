import { KORE_CONFIG } from './kore.config.js';

let _resolve;
const _promise = new Promise(res => (_resolve = res));

export async function loadEnv() {
    try {
        // FIX: URL relativa '/api/env' iba al servidor del microsite (nginx estático → 404).
        // Debe apuntar al backend: http://api.localhost/api/env
        const res = await fetch(`${KORE_CONFIG.API.BASE_URL}/env`);
        if (!res.ok) throw new Error(`/api/env HTTP ${res.status}`);
        window.KORE_ENV = await res.json();
    } catch (e) {
        // Supabase no configurado — los módulos que usen waitForEnv()
        // recibirán un objeto vacío y activarán su polling fallback.
        console.warn('[Env] Variables de entorno no disponibles:', e.message);
        window.KORE_ENV = {};
    }
    _resolve(window.KORE_ENV);
    return window.KORE_ENV;
}

export const waitForEnv = () => _promise;