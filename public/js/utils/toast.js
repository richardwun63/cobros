/**
 * toast.js
 * Módulo para gestionar las notificaciones tipo toast
 */

/**
 * Crea el contenedor para las notificaciones toast si no existe
 * @returns {HTMLElement} El contenedor de toasts
 */
function createToastContainer() {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) { 
        console.log('Creando contenedor de notificaciones toast');
        const newContainer = document.createElement('div');
        newContainer.id = 'toast-container';
        newContainer.className = 'toast-container';
        document.body.appendChild(newContainer);
        toastContainer = newContainer;
    }
    return toastContainer;
}

/**
 * Muestra una notificación toast
 * @param {string} title - Título de la notificación
 * @param {string} message - Mensaje de la notificación
 * @param {string} type - Tipo de notificación (info, success, error, warning)
 * @param {number} duration - Duración en milisegundos (por defecto 3500ms)
 */
function showToast(title, message, type = 'info', duration = 3500) {
    const toastContainer = createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    
    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    else if (type === 'error') iconClass = 'fas fa-times-circle';
    else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-icon"><i class="${iconClass}"></i></div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>`;
    
    toastContainer.appendChild(toast);
    
    // Configurar botón de cierre
    toast.querySelector('.toast-close').addEventListener('click', () => {
        hideToast(toast);
    });
    
    // Auto-cerrar después de la duración especificada
    setTimeout(() => {
        hideToast(toast);
    }, duration);
    
    return toast;
}

/**
 * Oculta una notificación toast con animación
 * @param {HTMLElement} toast - Elemento toast a ocultar
 */
function hideToast(toast) {
    const toastContainer = document.getElementById('toast-container');
    if (!toast || !toastContainer) return;
    
    toast.style.animation = 'fadeOutToast 0.5s ease forwards';
    
    setTimeout(() => {
        if (toast.parentNode === toastContainer) {
            toastContainer.removeChild(toast);
        }
    }, 500);
}

/**
 * Oculta todas las notificaciones toast
 */
function hideAllToasts() {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toasts = toastContainer.querySelectorAll('.toast');
    toasts.forEach(toast => {
        hideToast(toast);
    });
}

export { createToastContainer, showToast, hideToast, hideAllToasts };