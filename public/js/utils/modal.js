/**
 * modal.js
 * Módulo para gestionar los modales de la aplicación
 */

/**
 * Muestra un modal específico por su ID
 * @param {string} modalId - ID del modal a mostrar
 * @param {Function} callback - Función opcional a ejecutar cuando el modal se muestre
 */
function showModal(modalId, callback = null) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        
        // Enfocar el primer elemento interactivo
        const focusableElement = modal.querySelector('button, [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElement) {
            setTimeout(() => focusableElement.focus(), 50);
        }
        
        // Ejecutar callback si existe
        if (typeof callback === 'function') {
            callback(modal);
        }
    } else {
        console.error(`Modal con ID "${modalId}" no encontrado.`);
    }
}

/**
 * Oculta un modal específico
 * @param {string|HTMLElement} modal - ID o elemento del modal a ocultar
 */
function hideModal(modal) {
    if (typeof modal === 'string') {
        modal = document.getElementById(modal);
    }
    
    if (modal && modal.classList.contains('modal')) {
        modal.style.display = 'none';
    }
}

/**
 * Cierra todos los modales abiertos
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

/**
 * Crea un modal dinámicamente y lo agrega al DOM
 * @param {string} id - ID para el nuevo modal
 * @param {string} title - Título del modal
 * @param {string|HTMLElement} content - Contenido HTML o elemento para el cuerpo
 * @param {Object} options - Opciones adicionales (botones, tamaño, etc)
 * @returns {HTMLElement} El elemento modal creado
 */
function createModal(id, title, content, options = {}) {
    // Eliminar modal existente con mismo ID si existe
    const existingModal = document.getElementById(id);
    if (existingModal) {
        existingModal.remove();
    }
    
    // Opciones por defecto
    const defaultOptions = {
        size: 'normal', // normal, large, small
        closeButton: true,
        buttons: [
            { text: 'Cerrar', type: 'secondary', id: `${id}-close`, action: 'close' }
        ]
    };
    
    const modalOptions = { ...defaultOptions, ...options };
    
    // Crear estructura del modal
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = `modal ${modalOptions.size === 'large' ? 'large-modal' : modalOptions.size === 'small' ? 'small-modal' : ''}`;
    
    // Crear contenido HTML del modal
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                ${modalOptions.closeButton ? '<button class="close-modal"><i class="fas fa-times"></i></button>' : ''}
            </div>
            <div class="modal-body">
                ${typeof content === 'string' ? content : ''}
            </div>
            <div class="modal-footer">
                ${modalOptions.buttons.map(btn => 
                    `<button id="${btn.id || ''}" class="${btn.type || 'secondary'}-btn ${btn.class || ''}">${btn.text}</button>`
                ).join('')}
            </div>
        </div>
    `;
    
    // Si el contenido es un elemento, agregarlo al cuerpo del modal
    if (typeof content !== 'string' && content instanceof HTMLElement) {
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = '';
        modalBody.appendChild(content);
    }
    
    // Agregar al DOM
    document.body.appendChild(modal);
    
    // Configurar eventos
    setupModalListeners(modal, modalOptions);
    
    return modal;
}

/**
 * Configura los listeners para los modales
 * @param {HTMLElement} modal - El elemento modal
 * @param {Object} options - Opciones del modal (incluye botones y sus acciones)
 */
function setupModalListeners(modal, options = {}) {
    // Listener para cerrar al hacer clic en X
    const closeButton = modal.querySelector('.close-modal');
    if (closeButton) {
        closeButton.addEventListener('click', () => hideModal(modal));
    }
    
    // Listener para cerrar al hacer clic fuera del modal
    modal.addEventListener('click', event => {
        if (event.target === modal) {
            hideModal(modal);
        }
    });
    
    // Configurar botones
    const buttons = options.buttons || [];
    buttons.forEach(btn => {
        const buttonElement = modal.querySelector(`#${btn.id}`);
        if (buttonElement) {
            buttonElement.addEventListener('click', () => {
                // Acción predefinida "close"
                if (btn.action === 'close') {
                    hideModal(modal);
                } 
                // Función personalizada
                else if (typeof btn.action === 'function') {
                    btn.action(modal);
                }
            });
        }
    });
    
    // Manejar tecla Escape para cerrar modal
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            hideModal(modal);
        }
    });
}

export { showModal, hideModal, closeAllModals, createModal, setupModalListeners };