/**
 * services.js
 * Módulo para gestionar servicios en el sistema
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { createModal, closeAllModals } from '../utils/modal.js';
import { formatCurrency, formatDate } from '../utils/formatting.js';

// Variables para filtrado de servicios
let serviceFilterTimeout;

/**
 * Inicializa el módulo de servicios
 */
function initServices() {
    console.log('Inicializando módulo de Servicios...');
    
    // Configurar botones de nuevo servicio
    setupServiceButtons();
}

/**
 * Configura botones relacionados con servicios
 */
function setupServiceButtons() {
    // Botón para agregar nuevo servicio
    const addServiceBtn = document.getElementById('add-service-btn');
    if (addServiceBtn) {
        addServiceBtn.addEventListener('click', () => showServiceModal());
    }
}

/**
 * Configura los filtros para servicios
 */
function setupServiceFilters() {
    const servicePriceFilter = document.getElementById('service-price-filter');
    const serviceSearchInput = document.getElementById('service-search');
    const searchServiceBtn = document.getElementById('search-service-btn');
    
    // Función para aplicar filtros
    const applyServiceFilters = () => {
        clearTimeout(serviceFilterTimeout);
        serviceFilterTimeout = setTimeout(() => {
            const filtros = {};
            
            // Filtro por nombre
            const searchTerm = serviceSearchInput?.value.trim();
            if (searchTerm) filtros.nombre = searchTerm;
            
            // Filtro por precio
            const precioFilter = servicePriceFilter?.value;
            if (precioFilter && precioFilter !== 'all') {
                switch (precioFilter) {
                    case 'under-500':
                        filtros.precioMax = 500;
                        break;
                    case '500-1000':
                        filtros.precioMin = 500;
                        filtros.precioMax = 1000;
                        break;
                    case '1000-2000':
                        filtros.precioMin = 1000;
                        filtros.precioMax = 2000;
                        break;
                    case 'over-2000':
                        filtros.precioMin = 2000;
                        break;
                }
            }
            
            console.log("Aplicando filtros de servicio:", filtros);
            showLoadingOverlay('Filtrando servicios...');
            loadServices(filtros).finally(hideLoadingOverlay);
        }, 500);
    };
    
    // Agregar listeners a los inputs de filtro
    if (serviceSearchInput) {
        serviceSearchInput.addEventListener('input', applyServiceFilters);
    }
    
    if (servicePriceFilter) {
        servicePriceFilter.addEventListener('change', applyServiceFilters);
    }
    
    if (searchServiceBtn) {
        searchServiceBtn.addEventListener('click', applyServiceFilters);
    }
}

/**
 * Carga servicios según los filtros especificados
 * @param {Object} filtros - Filtros para la búsqueda
 * @returns {Promise<Array>} - Lista de servicios
 */
async function loadServices(filtros = {}) {
    console.log("API: Cargando servicios con filtros:", filtros);
    
    const serviciosTable = document.querySelector('.services-table tbody');
    if (!serviciosTable) {
        console.warn("No se encontró la tabla de servicios.");
        return [];
    }
    
    serviciosTable.innerHTML = '<tr><td colspan="6" class="center-text">Cargando servicios...</td></tr>';
    
    try {
        // Construir URL con parámetros de filtro
        let url = '/servicios';
        const queryParams = [];
        
        if (filtros.nombre) queryParams.push(`nombre=${encodeURIComponent(filtros.nombre)}`);
        if (filtros.precioMin) queryParams.push(`precioMin=${encodeURIComponent(filtros.precioMin)}`);
        if (filtros.precioMax) queryParams.push(`precioMax=${encodeURIComponent(filtros.precioMax)}`);
        if (filtros.page) queryParams.push(`page=${encodeURIComponent(filtros.page)}`);
        if (filtros.limit) queryParams.push(`limit=${encodeURIComponent(filtros.limit)}`);
        
        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
        }
        
        const servicios = await apiFetch(url);
        const serviciosArray = servicios.servicios || servicios;
        
        if (!serviciosArray || serviciosArray.length === 0) {
            serviciosTable.innerHTML = '<tr><td colspan="6" class="center-text">No se encontraron servicios con los criterios de búsqueda.</td></tr>';
            return [];
        }
        
        serviciosTable.innerHTML = ''; // Limpiar tabla
        
        serviciosArray.forEach(servicio => {
            const precio = parseFloat(servicio.precio_base || 0).toFixed(2);
            
            const fila = document.createElement('tr');
            fila.dataset.servicioId = servicio.id;
            
            fila.innerHTML = `
                <td>${servicio.id}</td>
                <td>${servicio.nombre_servicio}</td>
                <td>${servicio.descripcion || 'Sin descripción'}</td>
                <td>S/ ${precio}</td>
                <td>
                    <button class="service-stats-btn" title="Ver estadísticas">
                        <i class="fas fa-chart-bar"></i> Estadísticas
                    </button>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-action edit-btn" title="Editar servicio"><i class="fas fa-edit"></i></button>
                        <button class="icon-action delete-btn" title="Eliminar servicio"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            
            serviciosTable.appendChild(fila);
            
            // Configurar listeners para los botones de acción
            fila.querySelector('.service-stats-btn').addEventListener('click', () => viewServiceStats(servicio.id));
            fila.querySelector('.edit-btn').addEventListener('click', () => showServiceModal(servicio.id));
            fila.querySelector('.delete-btn').addEventListener('click', () => deleteService(servicio.id));
        });
        
        console.log(`Tabla de servicios actualizada con ${serviciosArray.length} servicios.`);
        
        return serviciosArray;
    } catch (error) {
        console.error("Error cargando servicios:", error);
        serviciosTable.innerHTML = '<tr><td colspan="6" class="center-text error-text">Error al cargar servicios. Intente de nuevo.</td></tr>';
        throw error;
    }
}

/**
 * Carga servicios para los selects de formularios
 * @returns {Promise<Array>} - Lista de servicios
 */
async function loadServicesForSelects() {
    console.log("API: Cargando servicios para selects...");
    
    try {
        const servicios = await apiFetch('/servicios');
        const serviciosArray = servicios.servicios || servicios;
        
        // Actualizar todos los select de servicios en la página
        document.querySelectorAll('select[id="payment-service"]').forEach(select => {
            const valorActual = select.value; // Guardar valor actual
            
            // Mantener solo la primera opción (placeholder)
            const primeraOpcion = select.querySelector('option:first-child');
            select.innerHTML = '';
            
            if (primeraOpcion) {
                select.appendChild(primeraOpcion);
            }
            
            if (serviciosArray && serviciosArray.length > 0) {
                serviciosArray.forEach(servicio => {
                    const option = document.createElement('option');
                    option.value = servicio.id;
                    option.textContent = servicio.nombre_servicio;
                    if (servicio.precio_base) {
                        option.dataset.precioBase = servicio.precio_base;
                    }
                    select.appendChild(option);
                });
            }
            
            // Restaurar valor seleccionado
            if (valorActual) {
                select.value = valorActual;
            }
            
            // Si el select tiene un listener para establecer el precio, dispararlo
            const event = new Event('change');
            select.dispatchEvent(event);
        });
        
        return serviciosArray;
    } catch (error) {
        console.error("Error cargando servicios para selects:", error);
        return [];
    }
}

/**
 * Muestra el modal para crear o editar un servicio
 * @param {number} servicioId - ID del servicio a editar (null para nuevo servicio)
 */
function showServiceModal(servicioId = null) {
    console.log(`Preparando modal servicio. ID: ${servicioId}`);
    
    // Título según sea nuevo servicio o edición
    const title = servicioId ? 'Editar Servicio' : 'Agregar Nuevo Servicio';
    
    // Contenido del formulario
    const formHtml = `
        <form id="service-form">
            <div class="form-group">
                <label for="service-name">Nombre del Servicio <span class="required">*</span></label>
                <input type="text" id="service-name" name="nombre_servicio" required>
            </div>
            <div class="form-group">
                <label for="service-price">Precio Base <span class="required">*</span></label>
                <input type="number" id="service-price" name="precio_base" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label for="service-description">Descripción</label>
                <textarea id="service-description" name="descripcion" rows="3"></textarea>
            </div>
        </form>
    `;
    
    // Opciones del modal
    const modalOptions = {
        size: 'normal',
        buttons: [
            { id: 'cancel-service', text: 'Cancelar', type: 'secondary', action: 'close' },
            { id: 'save-service', text: servicioId ? 'Actualizar Servicio' : 'Guardar Servicio', type: 'primary', action: () => saveService(servicioId) }
        ]
    };
    
    // Crear el modal
    const modal = createModal('service-modal', title, formHtml, modalOptions);
    
    // Si es edición, cargar datos del servicio
    if (servicioId) {
        showLoadingOverlay('Cargando datos del servicio...');
        
        apiFetch(`/servicios/${servicioId}`)
            .then(servicio => {
                document.getElementById('service-name').value = servicio.nombre_servicio || '';
                document.getElementById('service-price').value = servicio.precio_base || '';
                document.getElementById('service-description').value = servicio.descripcion || '';
                
                hideLoadingOverlay();
            })
            .catch(error => {
                hideLoadingOverlay();
                showToast('Error', `No se pudo cargar datos: ${error.message}`, 'error');
                modal.remove();
            });
    }
    
    // Mostrar el modal
    modal.style.display = 'flex';
}

/**
 * Guarda los datos de un servicio (nuevo o editado)
 * @param {number} servicioId - ID del servicio (null para servicio nuevo)
 */
async function saveService(servicioId) {
    const form = document.getElementById('service-form');
    if (!form) {
        showToast('Error', 'Formulario no encontrado', 'error');
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const datosServicio = {};
    
    formData.forEach((value, key) => {
        if (key === 'precio_base') {
            datosServicio[key] = parseFloat(value);
        } else {
            datosServicio[key] = value;
        }
    });
    
    if (!datosServicio.nombre_servicio) {
        showToast('Campo Requerido', 'El nombre del servicio es obligatorio.', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(servicioId ? 'Actualizando servicio...' : 'Guardando servicio...');
        
        let servicioResultado;
        
        if (servicioId) {
            // Actualizar servicio existente
            servicioResultado = await apiFetch(`/servicios/${servicioId}`, {
                method: 'PUT',
                body: datosServicio
            });
            showToast('Éxito', `Servicio "${servicioResultado.nombre_servicio}" actualizado correctamente.`, 'success');
        } else {
            // Crear nuevo servicio
            servicioResultado = await apiFetch('/servicios', {
                method: 'POST',
                body: datosServicio
            });
            showToast('Éxito', `Servicio "${servicioResultado.nombre_servicio}" creado correctamente.`, 'success');
        }
        
        // Cerrar modal y recargar datos
        closeAllModals();
        loadServices();
        loadServicesForSelects();
        
    } catch (error) {
        console.error('Error guardando servicio:', error);
        showToast('Error', error.data?.message || error.message || 'No se pudo guardar el servicio.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Muestra las estadísticas de un servicio
 * @param {number} servicioId - ID del servicio
 */
async function viewServiceStats(servicioId) {
    console.log(`Viendo estadísticas de servicio ID: ${servicioId}`);
    
    try {
        showLoadingOverlay('Cargando estadísticas...');
        
        // Cargar datos del servicio y sus estadísticas
        const [servicio, estadisticas] = await Promise.all([
            apiFetch(`/servicios/${servicioId}`),
            apiFetch(`/servicios/${servicioId}/estadisticas`)
        ]);
        
        // Contenido del modal
        const statsHtml = `
            <div class="service-stats-container">
                <div class="service-info">
                    <h3 id="stats-service-name">${servicio.nombre_servicio}</h3>
                    <p id="stats-service-description">${servicio.descripcion || 'Sin descripción'}</p>
                    <p><strong>Precio Base:</strong> <span id="stats-service-price">${formatCurrency(servicio.precio_base || 0)}</span></p>
                </div>

                <div class="stats-container">
                    <div class="stat-card">
                        <div class="stat-icon clients-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-details">
                            <h3>Clientes</h3>
                            <p class="stat-value" id="stats-service-clients">${estadisticas.clientesUnicos || 0}</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon payments-icon">
                            <i class="fas fa-file-invoice"></i>
                        </div>
                        <div class="stat-details">
                            <h3>Total Cobros</h3>
                            <p class="stat-value" id="stats-service-cobros">${estadisticas.totalCobros || 0}</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon money-icon">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                        <div class="stat-details">
                            <h3>Monto Total</h3>
                            <p class="stat-value" id="stats-service-monto">${formatCurrency(estadisticas.montoTotal || 0)}</p>
                        </div>
                    </div>
                </div>

                <div class="stats-details">
                    <h3>Detalles</h3>
                    <div class="stats-item">
                        <span class="stats-label">Cobros Pagados:</span>
                        <span class="stats-value" id="stats-service-pagados">${estadisticas.cobrosPagados || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Cobros Pendientes:</span>
                        <span class="stats-value" id="stats-service-pendientes">${estadisticas.cobrosPendientes || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Cobros Atrasados:</span>
                        <span class="stats-value" id="stats-service-atrasados">${estadisticas.cobrosAtrasados || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Porcentaje Cobrado:</span>
                        <span class="stats-value" id="stats-service-porcentaje">${estadisticas.porcentajeCobrado || '0%'}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Opciones del modal
        const modalOptions = {
            size: 'normal',
            buttons: [
                { id: 'close-service-stats', text: 'Cerrar', type: 'secondary', action: 'close' }
            ]
        };
        
        // Crear y mostrar el modal
        const modal = createModal('service-stats-modal', 'Estadísticas del Servicio', statsHtml, modalOptions);
        
        hideLoadingOverlay();
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error al cargar estadísticas del servicio:', error);
        showToast('Error', 'No se pudieron cargar las estadísticas del servicio.', 'error');
    }
}

/**
 * Elimina un servicio
 * @param {number} servicioId - ID del servicio a eliminar
 */
async function deleteService(servicioId) {
    if (!confirm('¿Está seguro de eliminar este servicio? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        showLoadingOverlay('Eliminando servicio...');
        
        await apiFetch(`/servicios/${servicioId}`, {
            method: 'DELETE'
        });
        
        showToast('Servicio Eliminado', 'El servicio ha sido eliminado correctamente.', 'success');
        loadServices();
        loadServicesForSelects();
        
    } catch (error) {
        console.error('Error al eliminar servicio:', error);
        
        let mensaje = 'No se pudo eliminar el servicio.';
        if (error.status === 409) {
            mensaje = 'No se puede eliminar el servicio porque está siendo utilizado en cobros.';
        } else if (error.data?.message) {
            mensaje = error.data.message;
        } else if (error.message) {
            mensaje = error.message;
        }
        
        showToast('Error al Eliminar', mensaje, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

export {
    initServices,
    setupServiceFilters,
    loadServices,
    loadServicesForSelects,
    showServiceModal,
    viewServiceStats,
    deleteService
};