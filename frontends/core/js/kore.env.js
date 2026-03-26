let _resolve;
const _promise = new Promise(res => (_resolve = res));

export async function loadEnv() {
    const res = await fetch('/api/env');
    window.KORE_ENV = await res.json();
    _resolve(window.KORE_ENV);
    return window.KORE_ENV;
}

export const waitForEnv = () => _promise;