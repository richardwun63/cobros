/**
 * loading.js
 * Módulo para gestionar el overlay de carga de la aplicación
 */

/**
 * Muestra un overlay de carga con un mensaje
 * @param {string} message - Mensaje a mostrar (por defecto "Cargando...")
 */
function showLoadingOverlay(message = 'Cargando...') {
    let overlay = document.getElementById('loading-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.color = 'white';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '10000';
        overlay.style.fontSize = '20px';
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i> ${message}`;
    overlay.style.display = 'flex';
    
    console.log('Overlay de carga mostrado:', message);
    
    // Prevenir que el usuario interactúe con la página mientras se muestra el overlay
    document.body.style.overflow = 'hidden';
    
    return overlay;
}

/**
 * Oculta el overlay de carga
 */
function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    
    if (overlay) {
        overlay.style.display = 'none';
        console.log('Overlay de carga ocultado.');
    }
    
    // Restaurar el scroll
    document.body.style.overflow = '';
}

/**
 * Actualiza el mensaje del overlay de carga
 * @param {string} message - Nuevo mensaje a mostrar
 */
function updateLoadingMessage(message) {
    const overlay = document.getElementById('loading-overlay');
    
    if (overlay && overlay.style.display !== 'none') {
        overlay.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i> ${message}`;
        console.log('Mensaje de overlay actualizado:', message);
    } else {
        // Si no está visible, mostrarlo con el nuevo mensaje
        showLoadingOverlay(message);
    }
}

export { showLoadingOverlay, hideLoadingOverlay, updateLoadingMessage };