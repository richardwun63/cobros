/**
 * clients.js
 * Módulo para gestionar clientes en el sistema
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { createModal, closeAllModals } from '../utils/modal.js';
import { formatDate, formatClientClass } from '../utils/formatting.js';
import * as paymentsModule from './payments.js';
import * as whatsappModule from './whatsapp.js';

// Variables para filtrado de clientes
let clientFilterTimeout;

/**
 * Inicializa el módulo de clientes
 */
function initClients() {
    console.log('Inicializando módulo de Clientes...');
    
    // Configurar botones de agregar cliente
    setupClientButtons();
}

/**
 * Configura botones relacionados con clientes
 */
function setupClientButtons() {
    // Botón de agregar cliente en navbar
    const addClientBtn = document.getElementById('add-client-btn');
    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => showClientModal());
    }
    
    // Botón de agregar cliente en página de clientes
    const addClientPageBtn = document.getElementById('add-client-page-btn');
    if (addClientPageBtn) {
        addClientPageBtn.addEventListener('click', () => showClientModal());
    }
}

/**
 * Configura los filtros para clientes
 */
function setupClientFilters() {
    const statusFilter = document.getElementById('status-filter');
    const serviceFilter = document.getElementById('service-filter');
    const clientSearchInput = document.getElementById('client-search');
    const searchClientBtn = document.getElementById('search-client-btn');

    // Función para aplicar filtros
    const applyClientFilters = () => {
        clearTimeout(clientFilterTimeout);
        clientFilterTimeout = setTimeout(() => {
            const filtros = {};
            
            // Obtener valor de búsqueda
            const searchTerm = clientSearchInput?.value.trim();
            if (searchTerm) filtros.nombre = searchTerm; 
            
            // Obtener estado seleccionado
            const status = statusFilter?.value;
            if (status && status !== 'all' && status !== 'todos') {
                // Mapear valores de UI a valores esperados por la API
                const estadoMap = {
                    'active': 'Activo',
                    'inactive': 'Inactivo',
                    'pending': 'Pendiente',
                    'overdue': 'Atrasado',
                    'Con pagos pendientes': 'Pendiente',
                    'Con pagos atrasados': 'Atrasado'
                };
                
                // Usar el valor mapeado si existe, de lo contrario usar el valor original
                filtros.estado = estadoMap[status] || status;
            }
            
            // Obtener servicio seleccionado
            const serviceId = serviceFilter?.value;
            if (serviceId && serviceId !== 'all' && serviceId !== 'todos') {
                filtros.servicioId = serviceId;
            }

            console.log("Aplicando filtros de cliente:", filtros);
            showLoadingOverlay('Filtrando clientes...');
            loadClients(filtros).finally(hideLoadingOverlay);
        }, 500); // 500ms debounce
    };
    
    // Agregar listeners a los inputs de filtro
    if (clientSearchInput) {
        clientSearchInput.addEventListener('input', applyClientFilters);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', applyClientFilters);
    }
    
    if (serviceFilter) {
        serviceFilter.addEventListener('change', applyClientFilters);
    }
    
    if (searchClientBtn) {
        searchClientBtn.addEventListener('click', applyClientFilters);
    }
}

/**
 * Carga los clientes según los filtros especificados
 * @param {Object} filtros - Filtros para la búsqueda
 * @returns {Promise<Array>} - Lista de clientes
 */
async function loadClients(filtros = {}) {
    console.log("API: Cargando clientes con filtros:", filtros);
    
    const clientesGrid = document.querySelector('.clients-grid');
    if (!clientesGrid) {
        console.warn("No se encontró el contenedor de clientes.");
        return [];
    }
    
    clientesGrid.innerHTML = '<div class="loading-placeholder">Cargando clientes...</div>';
    
    try {
        // Construir URL con parámetros de filtro
        let url = '/clientes';
        const queryParams = [];
        
        if (filtros.nombre) queryParams.push(`nombre=${encodeURIComponent(filtros.nombre)}`);
        if (filtros.estado) queryParams.push(`estado=${encodeURIComponent(filtros.estado)}`);
        if (filtros.servicioId) queryParams.push(`servicioId=${encodeURIComponent(filtros.servicioId)}`);
        if (filtros.page) queryParams.push(`page=${encodeURIComponent(filtros.page)}`);
        if (filtros.limit) queryParams.push(`limit=${encodeURIComponent(filtros.limit)}`);
        
        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
        }
        
        const clientes = await apiFetch(url);
        const clientesArray = clientes.clientes || clientes;
        
        if (!clientesArray || clientesArray.length === 0) {
            clientesGrid.innerHTML = '<div class="empty-state">No se encontraron clientes con los criterios de búsqueda.</div>';
            return [];
        }
        
        clientesGrid.innerHTML = ''; // Limpiar contenedor
        
        clientesArray.forEach(cliente => {
            const estadoClass = formatClientClass(cliente.estado_cliente);
            
            // Si hay cobros, determinar estado basado en ellos
            let estadoMostrado = cliente.estado_cliente || 'Activo';
            let estadoTag = `<div class="client-status ${estadoClass}">${estadoMostrado}</div>`;
            
            const clienteCard = document.createElement('div');
            clienteCard.className = 'client-card';
            clienteCard.dataset.clienteId = cliente.id;
            
            clienteCard.innerHTML = `
                <div class="client-card-header">
                    <div class="client-avatar">${cliente.nombre_cliente.charAt(0).toUpperCase()}</div>
                    ${estadoTag}
                </div>
                <div class="client-card-content">
                    <h3>${cliente.nombre_cliente}</h3>
                    <p><i class="fas fa-phone"></i> ${cliente.telefono || 'No registrado'}</p>
                    <p><i class="fas fa-envelope"></i> ${cliente.correo_electronico || 'No registrado'}</p>
                    <div class="client-services">
                        <span class="service-tag">Servicios cargando...</span>
                    </div>
                </div>
                <div class="client-card-footer">
                    <div class="payment-summary">
                    </div>
                    <div class="client-actions">
                        <button class="client-action-btn view-client-btn" title="Ver historial"><i class="fas fa-history"></i></button>
                        <button class="client-action-btn edit-btn" title="Editar cliente"><i class="fas fa-edit"></i></button>
                        <button class="client-action-btn remind-btn" title="Enviar recordatorio"><i class="fab fa-whatsapp"></i></button>
                        <button class="client-action-btn add-payment-btn" title="Registrar cobro"><i class="fas fa-plus-circle"></i></button>
                    </div>
                </div>
            `;
            
            clientesGrid.appendChild(clienteCard);
            
            // Cargar servicios del cliente
            loadClientServices(cliente.id, clienteCard);
            loadClientPaymentSummary(cliente.id, clienteCard);
            
            // Configurar listeners para los botones de acción
            clienteCard.querySelector('.edit-btn').addEventListener('click', () => showClientModal(cliente.id));
            clienteCard.querySelector('.view-client-btn').addEventListener('click', () => viewClientHistory(cliente.id));
            clienteCard.querySelector('.remind-btn').addEventListener('click', () => sendClientReminder(cliente.id));
            clienteCard.querySelector('.add-payment-btn').addEventListener('click', () => paymentsModule.showPaymentModal(null, cliente.id));
        });
        
        console.log(`Grid de clientes actualizado con ${clientesArray.length} clientes.`);
        
        return clientesArray;
    } catch (error) {
        console.error("Error cargando clientes:", error);
        clientesGrid.innerHTML = '<div class="error-state">Error al cargar clientes. Intente de nuevo.</div>';
        throw error;
    }
}

/**
 * Carga los servicios de un cliente
 * @param {number} clienteId - ID del cliente
 * @param {HTMLElement} clienteCard - Elemento HTML de la tarjeta del cliente
 */
async function loadClientServices(clienteId, clienteCard) {
    console.log(`API: Cargando servicios para cliente ID: ${clienteId}`);
    
    const serviciosContainer = clienteCard.querySelector('.client-services');
    if (!serviciosContainer) return;
    
    try {
        const servicios = await apiFetch(`/clientes/${clienteId}/servicios`);
        
        serviciosContainer.innerHTML = ''; // Limpiar placeholder
        
        if (!servicios || servicios.length === 0) {
            serviciosContainer.innerHTML = '<span class="no-services">Sin servicios</span>';
            return;
        }
        
        servicios.slice(0, 3).forEach(servicio => {
            const tag = document.createElement('span');
            tag.className = 'service-tag';
            tag.textContent = servicio.nombre_servicio || 'Servicio';
            serviciosContainer.appendChild(tag);
        });
        
        if (servicios.length > 3) {
            const moreTag = document.createElement('span');
            moreTag.className = 'service-tag more-tag';
            moreTag.textContent = `+${servicios.length - 3} más`;
            serviciosContainer.appendChild(moreTag);
        }
    } catch (error) {
        console.error(`Error cargando servicios del cliente ${clienteId}:`, error);
        serviciosContainer.innerHTML = '<span class="error-tag">Error al cargar</span>';
    }
}

/**
 * Carga el resumen de pagos de un cliente
 * @param {number} clienteId - ID del cliente
 * @param {HTMLElement} clienteCard - Elemento HTML de la tarjeta del cliente
 */
async function loadClientPaymentSummary(clienteId, clienteCard) {
    console.log(`API: Cargando resumen de pagos para cliente ID: ${clienteId}`);
    
    const paymentSummary = clienteCard.querySelector('.payment-summary');
    if (!paymentSummary) return;
    
    try {
        // En un caso real, obtendríamos estos datos de una API que devuelva estadísticas del cliente
        // Pero podemos simular usando los datos de cobros filtrados por cliente
        const cobros = await apiFetch(`/cobros?clienteId=${clienteId}`);
        
        if (!cobros || cobros.length === 0) {
            paymentSummary.innerHTML = '<p>Sin cobros registrados</p>';
            return;
        }
        
        // Calcular resumen
        const total = cobros.length;
        const pendientes = cobros.filter(c => c.estado_cobro === 'Pendiente').length;
        const atrasados = cobros.filter(c => c.estado_cobro === 'Atrasado').length;
        
        // Mostrar resumen
        paymentSummary.innerHTML = `
            <div class="summary-bar">
                <div class="summary-item">
                    <span class="summary-count">${total}</span>
                    <span class="summary-label">Total</span>
                </div>
                <div class="summary-item">
                    <span class="summary-count">${pendientes}</span>
                    <span class="summary-label">Pendientes</span>
                </div>
                <div class="summary-item">
                    <span class="summary-count">${atrasados}</span>
                    <span class="summary-label">Atrasados</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error(`Error cargando resumen de pagos del cliente ${clienteId}:`, error);
        paymentSummary.innerHTML = '<p class="error-text">Error al cargar datos</p>';
    }
}

/**
 * Carga clientes para los select de formularios
 * @returns {Promise<Array>} - Lista de clientes
 */
async function loadClientsForSelects() {
    console.log("API: Cargando clientes para selects...");
    
    try {
        const clientes = await apiFetch('/clientes');
        const clientesArray = clientes.clientes || clientes;
        
        // Actualizar todos los select de clientes en la página
        document.querySelectorAll('select[id="payment-client"]').forEach(select => {
            const valorActual = select.value; // Guardar valor actual para mantenerlo seleccionado
            
            // Mantener solo la primera opción (placeholder) y agregar los clientes
            const primeraOpcion = select.querySelector('option:first-child');
            select.innerHTML = '';
            
            if (primeraOpcion) {
                select.appendChild(primeraOpcion);
            }
            
            if (clientesArray && clientesArray.length > 0) {
                clientesArray.forEach(cliente => {
                    if (cliente.activo !== false) { // Si no está explícitamente inactivo
                        const option = document.createElement('option');
                        option.value = cliente.id;
                        option.textContent = cliente.nombre_cliente;
                        select.appendChild(option);
                    }
                });
            }
            
            // Restaurar valor seleccionado si existía
            if (valorActual) {
                select.value = valorActual;
            }
        });
        
        return clientesArray;
    } catch (error) {
        console.error("Error cargando clientes para selects:", error);
        return [];
    }
}

/**
 * Muestra el modal para crear o editar un cliente
 * @param {number} clienteId - ID del cliente a editar (null para nuevo cliente)
 */
function showClientModal(clienteId = null) {
    console.log(`Preparando modal cliente. ID: ${clienteId}`);
    
    // Título según sea nuevo cliente o edición
    const title = clienteId ? 'Editar Cliente' : 'Agregar Nuevo Cliente';
    
    // Contenido del formulario
    const formHtml = `
        <form id="add-client-form">
            <div class="form-group">
                <label for="client-name">Nombre del Cliente <span class="required">*</span></label>
                <input type="text" id="client-name" name="nombre_cliente" required>
            </div>
            <div class="form-group">
                <label for="client-tax-id">RUC/DNI</label>
                <input type="text" id="client-tax-id" name="ruc_dni">
            </div>
            <div class="form-group">
                <label for="client-phone">Teléfono</label>
                <input type="tel" id="client-phone" name="telefono">
            </div>
            <div class="form-group">
                <label for="client-email">Correo Electrónico</label>
                <input type="email" id="client-email" name="correo_electronico">
            </div>
            <div class="form-group">
                <label for="client-address">Dirección</label>
                <textarea id="client-address" name="direccion" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label for="client-status">Estado</label>
                <select id="client-status" name="estado_cliente">
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Atrasado">Atrasado</option>
                </select>
            </div>
        </form>
    `;
    
    // Opciones del modal
    const modalOptions = {
        size: 'normal',
        buttons: [
            { id: 'cancel-add-client', text: 'Cancelar', type: 'secondary', action: 'close' },
            { id: 'save-add-client', text: clienteId ? 'Actualizar Cliente' : 'Guardar Cliente', type: 'primary', action: () => saveClient(clienteId) }
        ]
    };
    
    // Crear el modal
    const modal = createModal('add-client-modal', title, formHtml, modalOptions);
    
    // Si es edición, cargar datos del cliente
    if (clienteId) {
        showLoadingOverlay('Cargando datos del cliente...');
        
        apiFetch(`/clientes/${clienteId}`)
            .then(cliente => {
                document.getElementById('client-name').value = cliente.nombre_cliente || '';
                document.getElementById('client-tax-id').value = cliente.ruc_dni || '';
                document.getElementById('client-phone').value = cliente.telefono || '';
                document.getElementById('client-email').value = cliente.correo_electronico || '';
                document.getElementById('client-address').value = cliente.direccion || '';
                document.getElementById('client-status').value = cliente.estado_cliente || 'Activo';
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
 * Guarda los datos de un cliente (nuevo o editado)
 * @param {number} clienteId - ID del cliente (null para cliente nuevo)
 */
async function saveClient(clienteId) {
    const form = document.getElementById('add-client-form');
    if (!form) {
        showToast('Error', 'Formulario no encontrado', 'error');
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const datosCliente = Object.fromEntries(formData.entries());
    
    if (!datosCliente.nombre_cliente) {
        showToast('Campo Requerido', 'El nombre del cliente es obligatorio.', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(clienteId ? 'Actualizando cliente...' : 'Guardando cliente...');
        
        let clienteResultado;
        
        if (clienteId) {
            // Actualizar cliente existente
            clienteResultado = await apiFetch(`/clientes/${clienteId}`, {
                method: 'PUT',
                body: datosCliente
            });
            showToast('Éxito', `Cliente "${clienteResultado.nombre_cliente}" actualizado correctamente.`, 'success');
        } else {
            // Crear nuevo cliente
            clienteResultado = await apiFetch('/clientes', {
                method: 'POST',
                body: datosCliente
            });
            showToast('Éxito', `Cliente "${clienteResultado.nombre_cliente}" creado correctamente.`, 'success');
        }
        
        // Cerrar modal y recargar datos
        closeAllModals();
        loadClients();
        loadClientsForSelects();
        
    } catch (error) {
        console.error('Error guardando cliente:', error);
        showToast('Error', error.data?.message || error.message || 'No se pudo guardar el cliente.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Muestra el historial de un cliente
 * @param {number} clienteId - ID del cliente
 */
function viewClientHistory(clienteId) {
    console.log(`Viendo historial de cliente ID: ${clienteId}`);
    
    showLoadingOverlay('Cargando historial del cliente...');
    
    // Cargar datos desde la API
    Promise.all([
        apiFetch(`/clientes/${clienteId}`),
        apiFetch(`/cobros?clienteId=${clienteId}`)
    ])
    .then(([cliente, cobros]) => {
        const cobrosArray = Array.isArray(cobros) ? cobros : cobros.cobros || [];
        
        // Crear modal con el historial
        const modalHtml = `
            <div class="client-profile">
                <div class="client-profile-header">
                    <div class="client-avatar large">${cliente.nombre_cliente.charAt(0).toUpperCase()}</div>
                    <div class="client-details">
                        <h3>${cliente.nombre_cliente}</h3>
                        <p class="client-id">ID: ${cliente.id}</p>
                        <p class="client-contact">
                            ${cliente.telefono ? `<i class="fas fa-phone"></i> ${cliente.telefono}` : ''}
                            ${cliente.telefono && cliente.correo_electronico ? ' • ' : ''}
                            ${cliente.correo_electronico ? `<i class="fas fa-envelope"></i> ${cliente.correo_electronico}` : ''}
                        </p>
                        <p class="client-location">
                            ${cliente.direccion ? `<i class="fas fa-map-marker-alt"></i> ${cliente.direccion}` : ''}
                        </p>
                    </div>
                    <div class="client-status-info">
                        <span class="status-badge ${formatClientClass(cliente.estado_cliente)}">${cliente.estado_cliente}</span>
                    </div>
                </div>
            </div>
            
            <div class="client-history-tabs">
                <button class="history-tab active" data-tab="payments">Cobros</button>
                <button class="history-tab" data-tab="activity">Actividad</button>
                <button class="history-tab" data-tab="info">Detalles</button>
            </div>
            
            <div class="client-history-content">
                <div class="history-tab-content active" id="payments-tab">
                    <div class="tab-actions">
                        <button class="secondary-btn add-payment-client-btn"><i class="fas fa-plus"></i> Registrar Cobro</button>
                    </div>
                    <div class="table-container">
                        <table class="history-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Servicio</th>
                                    <th>Emisión</th>
                                    <th>Vencimiento</th>
                                    <th>Monto</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cobrosArray.length > 0 ? 
                                    cobrosArray.map(cobro => `
                                        <tr>
                                            <td>${cobro.id}</td>
                                            <td>${cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'No especificado'}</td>
                                            <td>${formatDate(cobro.fecha_emision, 'short')}</td>
                                            <td>${formatDate(cobro.fecha_vencimiento, 'short')}</td>
                                            <td>${cobro.moneda || 'PEN'} ${parseFloat(cobro.monto || 0).toFixed(2)}</td>
                                            <td><span class="status-badge ${formatClientClass(cobro.estado_cobro)}">${cobro.estado_cobro}</span></td>
                                            <td>
                                                <div class="action-buttons">
                                                    <button class="icon-action view-btn" data-cobro-id="${cobro.id}"><i class="fas fa-eye"></i></button>
                                                    <button class="icon-action edit-btn" data-cobro-id="${cobro.id}"><i class="fas fa-edit"></i></button>
                                                    <button class="icon-action receipt-btn" data-cobro-id="${cobro.id}"><i class="fas fa-file-invoice"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="7" class="center-text">No hay cobros registrados para este cliente.</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="history-tab-content" id="activity-tab">
                    <div class="timeline">
                        <div class="timeline-event">
                            <div class="timeline-icon"><i class="fas fa-user-plus"></i></div>
                            <div class="timeline-content">
                                <h4>Cliente registrado</h4>
                                <p class="timeline-date">${formatDate(cliente.fecha_registro, 'full')}</p>
                            </div>
                        </div>
                        ${cobrosArray.map((cobro, index) => `
                            <div class="timeline-event">
                                <div class="timeline-icon"><i class="fas fa-file-invoice"></i></div>
                                <div class="timeline-content">
                                    <h4>Cobro ${cobro.estado_cobro === 'Pagado' ? 'pagado' : 'registrado'}</h4>
                                    <p>Monto: ${cobro.moneda || 'PEN'} ${parseFloat(cobro.monto || 0).toFixed(2)}</p>
                                    <p class="timeline-date">${formatDate(cobro.fecha_creacion, 'full')}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="history-tab-content" id="info-tab">
                    <div class="client-details-info">
                        <div class="detail-section">
                            <h3>Datos Personales</h3>
                            <div class="detail-group">
                                <div class="detail-item">
                                    <span class="detail-label">Nombre:</span>
                                    <span class="detail-value">${cliente.nombre_cliente}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">RUC/DNI:</span>
                                    <span class="detail-value">${cliente.ruc_dni || 'No registrado'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Teléfono:</span>
                                    <span class="detail-value">${cliente.telefono || 'No registrado'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Correo:</span>
                                    <span class="detail-value">${cliente.correo_electronico || 'No registrado'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Dirección:</span>
                                    <span class="detail-value">${cliente.direccion || 'No registrada'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h3>Estadísticas</h3>
                            <div class="client-stats">
                                <div class="stat-item">
                                    <div class="stat-value">${cobrosArray.length}</div>
                                    <div class="stat-label">Total Cobros</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${cobrosArray.filter(c => c.estado_cobro === 'Pagado').length}</div>
                                    <div class="stat-label">Cobros Pagados</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${cobrosArray.filter(c => c.estado_cobro === 'Pendiente').length}</div>
                                    <div class="stat-label">Cobros Pendientes</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${cobrosArray.filter(c => c.estado_cobro === 'Atrasado').length}</div>
                                    <div class="stat-label">Cobros Atrasados</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Opciones del modal
        const modalOptions = {
            size: 'large',
            buttons: [
                { id: 'close-history-modal', text: 'Cerrar', type: 'secondary', action: 'close' },
                { id: 'edit-client-btn', text: 'Editar Cliente', type: 'primary', action: () => {
                    closeAllModals();
                    showClientModal(clienteId);
                }}
            ]
        };
        
        // Crear y mostrar el modal
        const modal = createModal('client-history-modal', 'Historial de Cliente', modalHtml, modalOptions);
        
        // Configurar tabs de historial
        modal.querySelectorAll('.history-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                
                // Actualizar tabs
                modal.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Actualizar contenido
                modal.querySelectorAll('.history-tab-content').forEach(c => c.classList.remove('active'));
                modal.querySelector(`#${tabId}-tab`).classList.add('active');
            });
        });
        
        // Botón para agregar cobro
        modal.querySelector('.add-payment-client-btn').addEventListener('click', () => {
            closeAllModals();
            paymentsModule.showPaymentModal(null, clienteId);
        });
        
        // Botones de acciones en la tabla de cobros
        modal.querySelectorAll('.icon-action').forEach(btn => {
            const cobroId = btn.getAttribute('data-cobro-id');
            if (!cobroId) return;
            
            if (btn.classList.contains('view-btn')) {
                btn.addEventListener('click', () => {
                    closeAllModals();
                    paymentsModule.viewPaymentDetail(cobroId);
                });
            } else if (btn.classList.contains('edit-btn')) {
                btn.addEventListener('click', () => {
                    closeAllModals();
                    paymentsModule.showPaymentModal(cobroId);
                });
            } else if (btn.classList.contains('receipt-btn')) {
                btn.addEventListener('click', () => {
                    closeAllModals();
                    paymentsModule.generateReceipt(cobroId);
                });
            }
        });
        
        hideLoadingOverlay();
    })
    .catch(error => {
        hideLoadingOverlay();
        console.error(`Error cargando historial del cliente ${clienteId}:`, error);
        showToast('Error', 'No se pudo cargar el historial del cliente.', 'error');
    });
}

/**
 * Envía un recordatorio de pago a un cliente
 * @param {number} clienteId - ID del cliente
 */
function sendClientReminder(clienteId) {
    console.log(`Abriendo modal de recordatorio para cliente ID: ${clienteId}`);
    whatsappModule.sendClientReminder(clienteId);
}

/**
 * Elimina un cliente
 * @param {number} clienteId - ID del cliente a eliminar
 */
async function deleteClient(clienteId) {
    if (!confirm('¿Está seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        showLoadingOverlay('Eliminando cliente...');
        
        await apiFetch(`/clientes/${clienteId}`, {
            method: 'DELETE'
        });
        
        showToast('Cliente Eliminado', 'Cliente eliminado correctamente.', 'success');
        loadClients();
        
    } catch (error) {
        console.error(`Error eliminando cliente ${clienteId}:`, error);
        
        let mensaje = 'No se pudo eliminar el cliente.';
        if (error.status === 409) {
            mensaje = 'No se puede eliminar el cliente porque tiene cobros asociados.';
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
    initClients,
    setupClientFilters,
    loadClients,
    loadClientsForSelects,
    showClientModal,
    viewClientHistory,
    sendClientReminder,
    deleteClient
};