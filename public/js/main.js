/**
 * main.js
 * Punto de entrada de la aplicación Pegasus
 */

import { initApp } from './app.js';
import { createToastContainer } from './utils/toast.js';
import { setupErrorHandling } from './utils/error.js';

// Función principal que se ejecuta cuando el DOM está listo
function documentReady() {
    console.log('DOM cargado. Iniciando aplicación PEGASUS...');
    
    // Crear contenedor de notificaciones toast
    createToastContainer();
    
    // Configurar manejo global de errores
    setupErrorHandling();
    
    // Inicializar la aplicación
    initApp();
}

// Registrar el evento DOMContentLoaded para iniciar la aplicación
document.addEventListener('DOMContentLoaded', documentReady);

// Prevenir cierre accidental de la página si hay cambios no guardados
window.addEventListener('beforeunload', function(event) {
    // Si hay modales abiertos que estén editando datos
    const modalAbierto = document.querySelector('.modal[style*="display: flex"]');
    if (modalAbierto) {
        // Verificar si tiene formularios con datos
        const formulario = modalAbierto.querySelector('form');
        if (formulario && formulario.querySelector('input, select, textarea')) {
            event.preventDefault();
            event.returnValue = '¿Desea abandonar la página? Los cambios podrían perderse.';
            return event.returnValue;
        }
    }
});

// Configurar variables de depuración
window.debugPegasus = {
    toggleDebugMode: function() {
        const currentMode = localStorage.getItem('debugMode') === 'true';
        localStorage.setItem('debugMode', (!currentMode).toString());
        console.log(`Modo debug ${!currentMode ? 'activado' : 'desactivado'}`);
        return !currentMode;
    },
    
    log: function(mensaje, objeto = null) {
        if (localStorage.getItem('debugMode') === 'true') {
            if (objeto) {
                console.log(`[DEBUG] ${mensaje}:`, objeto);
            } else {
                console.log(`[DEBUG] ${mensaje}`);
            }
        }
    }
};

// Exportar la función de inicio
export { documentReady };