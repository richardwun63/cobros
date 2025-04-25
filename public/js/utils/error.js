/**
 * error.js
 * Módulo para el manejo de errores de la aplicación
 */

import { showToast } from './toast.js';
import { hideLoadingOverlay } from './loading.js';

/**
 * Configura el manejo global de errores no capturados
 */
function setupErrorHandling() {
    // Errores de JavaScript no capturados
    window.addEventListener('error', function(event) {
        console.error('Error no capturado:', event.error);
        
        // Mostrar toast solo si no es un error de red (que ya se maneja en apiFetch)
        if (event.error && !event.error.message?.includes('NetworkError')) {
            showToast('Error', 'Ha ocurrido un error inesperado en la aplicación.', 'error');
        }
        
        // Liberar overlay de carga si está presente
        hideLoadingOverlay();
        
        // Evitar que el error se propague
        event.preventDefault();
    });

    // Promesas rechazadas no capturadas
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Promesa rechazada no capturada:', event.reason);
        
        // Mostrar toast solo para errores que no sean de red
        if (event.reason && 
            !event.reason.message?.includes('NetworkError') && 
            !event.reason.message?.includes('No autenticado')) {
            showToast('Error', 'Ha ocurrido un error inesperado en la aplicación.', 'error');
        }
        
        // Liberar overlay de carga si está presente
        hideLoadingOverlay();
        
        // Evitar que el error se propague
        event.preventDefault();
    });

    console.log('Manejo global de errores configurado.');
}

/**
 * Maneja un error y muestra una notificación adecuada
 * @param {Error} error - El error capturado
 * @param {string} defaultMessage - Mensaje por defecto si no hay uno específico
 * @param {string} context - Contexto donde ocurrió el error (para logging)
 */
function handleError(error, defaultMessage = 'Ocurrió un error inesperado', context = '') {
    // Asegurar que el overlay de carga se oculta
    hideLoadingOverlay();
    
    // Construir mensaje de log detallado
    const logContext = context ? `[${context}] ` : '';
    console.error(`${logContext}Error:`, error);
    
    // Determinar mensaje para el usuario
    let userMessage = defaultMessage;
    
    if (error.data?.message) {
        userMessage = error.data.message;
    } else if (error.message) {
        userMessage = error.message;
    }
    
    // Determinar tipo de notificación según el error
    let toastType = 'error';
    
    if (error.status === 401 || error.status === 403) {
        toastType = 'warning';
    } else if (error.status === 404) {
        userMessage = 'El recurso solicitado no existe.';
    } else if (error.status >= 500) {
        userMessage = 'Error interno del servidor. Por favor, intente más tarde.';
    }
    
    // Mostrar notificación
    showToast('Error', userMessage, toastType);
    
    return error;
}

export { setupErrorHandling, handleError };