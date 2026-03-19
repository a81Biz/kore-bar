import { KORE_CONFIG } from '/core/js/kore.config.js';

/**
 * Helper interno para construir la URL final.
 * Une la BASE_URL y reemplaza dinámicamente los parámetros (ej. :id, :code).
 * @param {string} endpointRaw - Ruta cruda (ej. '/admin/employees/:id')
 * @param {Object} params - Objeto con valores (ej. { id: '80219608' })
 * @returns {string} URL completa y parseada
 */
const buildUrl = (endpointRaw, params = {}) => {
    let finalPath = endpointRaw;

    if (params && typeof params === 'object') {
        Object.keys(params).forEach(key => {
            finalPath = finalPath.replace(`:${key}`, encodeURIComponent(params[key]));
        });
    }

    return `${KORE_CONFIG.API.BASE_URL}${finalPath}`;
};

export async function postData(endpoint, data = {}, params = {}) {
    try {
        const url = buildUrl(endpoint, params);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const jsonResponse = await response.json();

        if (!response.ok) {
            throw new Error(jsonResponse.error || jsonResponse.message || `HTTP Error ${response.status}`);
        }

        return jsonResponse;
    } catch (error) {
        console.error(`[HTTP Client] Error executing POST against ${endpoint}:`, error);
        throw error;
    }
}

export async function fetchData(endpoint, params = {}) {
    try {
        const url = buildUrl(endpoint, params);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const jsonResponse = await response.json();

        if (!response.ok) {
            throw new Error(jsonResponse.error || jsonResponse.message || `HTTP Error ${response.status}`);
        }

        return jsonResponse;
    } catch (error) {
        console.error(`[HTTP Client] Error executing GET against ${endpoint}:`, error);
        throw error;
    }
}

export async function putData(endpoint, data = {}, params = {}) {
    try {
        const url = buildUrl(endpoint, params);

        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const jsonResponse = await response.json();

        if (!response.ok) {
            throw new Error(jsonResponse.error || jsonResponse.message || `HTTP Error ${response.status}`);
        }

        return jsonResponse;
    } catch (error) {
        console.error(`[HTTP Client] Error executing PUT against ${endpoint}:`, error);
        throw error;
    }
}

// 🟢 NUEVO: Necesario para tu baja lógica (DELETE /employees/:id)
export async function deleteData(endpoint, params = {}) {
    try {
        const url = buildUrl(endpoint, params);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const jsonResponse = await response.json();

        if (!response.ok) {
            throw new Error(jsonResponse.error || jsonResponse.message || `HTTP Error ${response.status}`);
        }

        return jsonResponse;
    } catch (error) {
        console.error(`[HTTP Client] Error executing DELETE against ${endpoint}:`, error);
        throw error;
    }
}