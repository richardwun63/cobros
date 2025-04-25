/**
 * api.js
 * Módulo para gestionar la comunicación con la API del backend
 */

import { showToast } from './toast.js';
import { handleLogout } from '../modules/auth.js';

// Configuración de la API
const API_BASE_URL = 'http://localhost:3001/api';
const API_TIMEOUT = 60000; // 60 segundos

/**
 * Realiza peticiones a la API del backend
 * @param {string} endpoint - Ruta a consultar (sin la base URL)
 * @param {Object} options - Opciones para fetch (method, body, headers)
 * @returns {Promise} - Promesa con la respuesta de la API
 */
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    const currentAuthToken = sessionStorage.getItem('authToken');
    console.log(`API Fetch: ${method} a ${url}`);

    try {
        new URL(url);
    } catch (error) {
        console.error(`API Fetch: URL inválida ${url}`, error);
        throw new Error('URL inválida para API Fetch');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (currentAuthToken && endpoint !== '/auth/login') {
        headers['Authorization'] = `Bearer ${currentAuthToken}`;
        console.log('API Fetch: Token añadido al header Authorization.');
    } else if (!currentAuthToken && endpoint !== '/auth/login') {
        console.warn(`API Fetch: Intentando llamar a ${endpoint} sin token!`);
        showToast('Error de Autenticación', 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
        setTimeout(() => {
            handleLogout(true);
        }, 2000);
        throw new Error('No autenticado');
    }

    const fetchOptions = { ...options, headers };

    if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof FormData)) {
        try {
            fetchOptions.body = JSON.stringify(fetchOptions.body);
        } catch (error) {
            console.error('API Fetch: Error al convertir body a JSON:', error);
            return Promise.reject(new Error('Error interno al preparar la petición.'));
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        fetchOptions.signal = controller.signal;
        
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        const status = response.status;
        console.log(`API Fetch: Respuesta de ${url}. Status: ${status}`);

        if (status === 401) {
            console.error('API Fetch: Error de autenticación (401)');
            showToast('Sesión Expirada', 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
            setTimeout(() => {
                handleLogout(true);
            }, 2000);
            throw new Error('No autenticado');
        }

        let responseData = null;
        const contentType = response.headers.get("content-type");

        if (status === 204) {
            console.log('API Fetch: Respuesta 204 No Content.');
            responseData = { success: true, message: 'Operación exitosa (sin contenido).' };
        } else if (contentType && contentType.includes("application/json")) {
            responseData = await response.json();
            console.log(`API Fetch: Respuesta JSON parseada para ${url}.`);
        } else if (response.ok) {
            responseData = await response.text();
            console.log(`API Fetch: Respuesta OK no JSON recibida como texto de ${url}.`);
            responseData = { success: true, data: responseData };
        } else {
            try {
                responseData = await response.json();
                console.log(`API Fetch: Cuerpo del error JSON parseado para ${url}.`);
            } catch (e) {
                console.log(`API Fetch: Cuerpo del error no es JSON para ${url}.`);
                responseData = { message: `Error ${status}: ${response.statusText}` };
            }
        }

        if (!response.ok) {
            const errorMessage = responseData?.message || `Error ${status}`;
            console.error(`API Fetch: Error en respuesta de ${url}. Status: ${status}, Mensaje: ${errorMessage}`, responseData);
            const error = new Error(errorMessage);
            error.status = status;
            error.data = responseData;
            throw error;
        }
        return responseData;
    } catch (error) {
        console.error(`API Fetch: Error durante la petición a ${url}:`, error);
        
        // Manejo especial para errores de tiempo de espera
        if (error.name === 'AbortError') {
            showToast('Error de Conexión', 'La solicitud ha excedido el tiempo de espera. Intente nuevamente.', 'error');
            throw new Error('Tiempo de espera agotado');
        }
        
        if (!error.message) error.message = "Error de conexión o respuesta inválida.";
        throw error;
    }
}

/**
 * Maneja errores de peticiones API y muestra notificaciones
 * @param {Error} error - Objeto de error
 * @param {string} defaultMessage - Mensaje por defecto si no hay mensaje específico
 */
function handleApiError(error, defaultMessage = 'Error en la operación') {
    console.error('API Error:', error);
    
    let message = defaultMessage;
    
    if (error.data?.message) {
        message = error.data.message;
    } else if (error.message) {
        message = error.message;
    }
    
    showToast('Error', message, 'error');
    return message;
}

export { apiFetch, handleApiError };