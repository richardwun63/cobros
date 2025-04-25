/**
 * payments.js
 * Módulo para gestionar cobros en el sistema
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { createModal, closeAllModals } from '../utils/modal.js';
import { formatCurrency, formatDate, formatStatusBadge, calculateDelay } from '../utils/formatting.js';
import * as whatsappModule from './whatsapp.js';

// Variables para filtrado de cobros
let paymentFilterTimeout;

/**
 * Inicializa el módulo de cobros
 */
function initPayments() {
    console.log('Inicializando módulo de Cobros...');
    
    // Configurar botones de nuevo cobro
    setupPaymentButtons();
    
    // Configurar checkboxes para acciones masivas
    setupBulkActions();
}

/**
 * Configura botones relacionados con cobros
 */
function setupPaymentButtons() {
    // Botón para agregar nuevo cobro
    const addPaymentBtn = document.getElementById('add-payment-btn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => showPaymentModal());
    }
}

/**
 * Configura las acciones masivas para cobros
 */
function setupBulkActions() {
    // Checkbox "Seleccionar Todos"
    const selectAllCheckbox = document.getElementById('select-all-payments');
    const paymentsTableBody = document.querySelector('#payments .payments-table tbody');
    
    if (selectAllCheckbox && paymentsTableBody) {
        selectAllCheckbox.addEventListener('change', function() {
            paymentsTableBody.querySelectorAll('.payment-checkbox').forEach(cb => cb.checked = this.checked);
            updateBulkActionsState();
        });
        
        if (paymentsTableBody) {
            paymentsTableBody.addEventListener('change', function(event) {
                if (event.target.classList.contains('payment-checkbox')) {
                    updateBulkActionsState();
                }
            });
        }
    }
    
    // Botones de acciones masivas
    const bulkRemindBtn = document.querySelector('.bulk-remind-btn');
    const bulkReceiptBtn = document.querySelector('.bulk-receipt-btn');
    
    if (bulkRemindBtn) {
        bulkRemindBtn.addEventListener('click', handleBulkRemind);
    }
    
    if (bulkReceiptBtn) {
        bulkReceiptBtn.addEventListener('click', handleBulkReceipt);
    }
}

/**
 * Actualiza el estado de los botones de acciones masivas
 */
function updateBulkActionsState() {
    console.log("Actualizando estado de acciones masivas...");
    
    const checkboxes = document.querySelectorAll('.payment-checkbox:checked');
    const bulkActionBtns = document.querySelectorAll('.bulk-action-btn');
    const selectedCountSpan = document.querySelector('.selected-count');
    
    if (selectedCountSpan) {
        selectedCountSpan.textContent = `${checkboxes.length} seleccionados`;
    }
    
    if (bulkActionBtns.length > 0) {
        const isEnabled = checkboxes.length > 0;
        
        bulkActionBtns.forEach(btn => {
            btn.disabled = !isEnabled;
            if (isEnabled) btn.classList.remove('disabled');
            else btn.classList.add('disabled');
        });
    }
}

/**
 * Maneja el envío masivo de recordatorios
 */
function handleBulkRemind() {
    const checkboxes = document.querySelectorAll('.payment-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    const cobroIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-payment-id')).filter(id => id);
    
    if (confirm(`¿Enviar recordatorio a ${cobroIds.length} cobros seleccionados?`)) {
        // Idealmente esto se haría con una sola petición a la API
        // Pero por ahora, simulamos enviando uno por uno
        showLoadingOverlay(`Enviando ${cobroIds.length} recordatorios...`);
        
        let completados = 0;
        let fallidos = 0;
        
        cobroIds.forEach(id => {
            whatsappModule.sendPaymentReminder(id, 'recordatorio')
                .then(() => {
                    completados++;
                    if (completados + fallidos === cobroIds.length) {
                        hideLoadingOverlay();
                        showToast('Recordatorios Enviados', `${completados} de ${cobroIds.length} recordatorios enviados.`, 'success');
                    }
                })
                .catch(error => {
                    console.error(`Error al enviar recordatorio para cobro ${id}:`, error);
                    fallidos++;
                    if (completados + fallidos === cobroIds.length) {
                        hideLoadingOverlay();
                        showToast('Recordatorios Enviados', `${completados} de ${cobroIds.length} recordatorios enviados.`, completados > 0 ? 'warning' : 'error');
                    }
                });
        });
    }
}

/**
 * Maneja la generación masiva de recibos
 */
function handleBulkReceipt() {
    const checkboxes = document.querySelectorAll('.payment-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    const cobroIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-payment-id')).filter(id => id);
    
    if (confirm(`¿Generar recibos para ${cobroIds.length} cobros seleccionados?`)) {
        // En una implementación real, generaríamos un PDF por cada recibo o un ZIP con todos
        showToast('Generando Recibos', `Generando ${cobroIds.length} recibos...`, 'info');
        
        setTimeout(() => {
            showToast('Recibos Generados', `${cobroIds.length} recibos generados correctamente.`, 'success');
        }, 1500);
    }
}

/**
 * Configura los filtros para cobros
 */
function setupPaymentFilters() {
    const paymentStatusFilter = document.getElementById('payment-status-filter');
    const paymentDateFilter = document.getElementById('payment-date-filter');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    const applyDateFilterBtn = document.getElementById('apply-date-filter');
    const dateRangeFilterDiv = document.getElementById('date-range-filter');

    if (paymentDateFilter && dateRangeFilterDiv) { // Listener para mostrar/ocultar rango custom
        paymentDateFilter.addEventListener('change', () => { 
            dateRangeFilterDiv.style.display = paymentDateFilter.value === 'custom' ? 'flex' : 'none'; 
        });
        dateRangeFilterDiv.style.display = paymentDateFilter.value === 'custom' ? 'flex' : 'none'; // Estado inicial
    }

    const applyPaymentFilters = () => {
        clearTimeout(paymentFilterTimeout);
        paymentFilterTimeout = setTimeout(() => {
            const filtros = {};
            
            // Filtrar por estado
            const estado = paymentStatusFilter?.value;
            if (estado && estado !== 'all' && estado !== 'todos') {
                // Mapear valores de UI a valores esperados por la API
                const estadoMap = {
                    'paid': 'Pagado',
                    'pending': 'Pendiente',
                    'overdue': 'Atrasado'
                };
                
                filtros.estado = estadoMap[estado] || estado;
            }
            
            // Filtrar por período o fechas específicas
            const periodo = paymentDateFilter?.value;
            if (periodo === 'custom') {
                if (dateFromInput?.value) filtros.fechaInicio = dateFromInput.value;
                if (dateToInput?.value) filtros.fechaFin = dateToInput.value;
            } else if (periodo && periodo !== 'all' && periodo !== 'todos') { 
                filtros.periodo = periodo; 
            }

            console.log("Aplicando filtros de cobro:", filtros);
            showLoadingOverlay('Filtrando cobros...');
            loadPayments(filtros).finally(hideLoadingOverlay);
        }, 300);
    };
    
    // Agregar listeners a los filtros de cobros
    if (paymentStatusFilter) {
        paymentStatusFilter.addEventListener('change', applyPaymentFilters);
    }
    
    if (paymentDateFilter) {
        paymentDateFilter.addEventListener('change', applyPaymentFilters);
    }
    
    if (dateFromInput) {
        dateFromInput.addEventListener('change', applyPaymentFilters);
    }
    
    if (dateToInput) {
        dateToInput.addEventListener('change', applyPaymentFilters);
    }
    
    if (applyDateFilterBtn) {
        applyDateFilterBtn.addEventListener('click', applyPaymentFilters);
    }
}

/**
 * Carga cobros según los filtros especificados
 * @param {Object} filtros - Filtros para la búsqueda
 * @returns {Promise<Array>} - Lista de cobros
 */
async function loadPayments(filtros = {}) {
    console.log("API: Cargando cobros con filtros:", filtros);
    
    const cobrosTable = document.querySelector('#payments .payments-table tbody');
    if (!cobrosTable) {
        console.warn("No se encontró la tabla de cobros.");
        return [];
    }
    
    cobrosTable.innerHTML = '<tr><td colspan="9" class="center-text">Cargando cobros...</td></tr>';
    
    try {
        // Construir URL con parámetros de filtro
        let url = '/cobros';
        const queryParams = [];
        
        if (filtros.estado) queryParams.push(`estado=${encodeURIComponent(filtros.estado)}`);
        if (filtros.clienteId) queryParams.push(`clienteId=${encodeURIComponent(filtros.clienteId)}`);
        if (filtros.fechaInicio) queryParams.push(`fechaInicio=${encodeURIComponent(filtros.fechaInicio)}`);
        if (filtros.fechaFin) queryParams.push(`fechaFin=${encodeURIComponent(filtros.fechaFin)}`);
        if (filtros.periodo) queryParams.push(`periodo=${encodeURIComponent(filtros.periodo)}`);
        if (filtros.page) queryParams.push(`page=${encodeURIComponent(filtros.page)}`);
        if (filtros.limit) queryParams.push(`limit=${encodeURIComponent(filtros.limit)}`);
        
        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
        }
        
        const cobros = await apiFetch(url);
        const cobrosArray = Array.isArray(cobros) ? cobros : cobros.cobros || [];
        
        if (!cobrosArray || cobrosArray.length === 0) {
            cobrosTable.innerHTML = '<tr><td colspan="9" class="center-text">No se encontraron cobros con los criterios de búsqueda.</td></tr>';
            return [];
        }
        
        cobrosTable.innerHTML = ''; // Limpiar tabla
        
        cobrosArray.forEach(cobro => {
            const estadoClass = formatStatusBadge(cobro.estado_cobro);
            const fechaEmision = formatDate(cobro.fecha_emision, 'short');
            const fechaVencimiento = formatDate(cobro.fecha_vencimiento, 'short');
            
            // Calcular días de atraso
            let diasAtraso = '';
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vencimiento = new Date(cobro.fecha_vencimiento);
            vencimiento.setHours(0, 0, 0, 0);
            
            if (cobro.estado_cobro === 'Atrasado') {
                const diffTime = Math.abs(hoy - vencimiento);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                diasAtraso = `<span class="delay-days">${diffDays} días</span>`;
            } else if (cobro.estado_cobro === 'Pendiente' && hoy > vencimiento) {
                // Si está pendiente pero vencido, mostrar alerta
                diasAtraso = `<span class="delay-days warning">Vencido</span>`;
            } else {
                diasAtraso = '-';
            }
            
            const fila = document.createElement('tr');
            fila.dataset.cobroId = cobro.id;
            
            fila.innerHTML = `
                <td><input type="checkbox" class="payment-checkbox" data-payment-id="${cobro.id}"></td>
                <td>
                    <div class="client-info">
                        <div class="client-initial">${(cobro.cliente?.nombre_cliente || 'C').charAt(0)}</div>
                        <span>${cobro.cliente?.nombre_cliente || 'Cliente no asignado'}</span>
                    </div>
                </td>
                <td>${cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'No especificado'}</td>
                <td>${fechaEmision}</td>
                <td>${fechaVencimiento}</td>
                <td>${formatCurrency(cobro.monto || 0, cobro.moneda || 'PEN')}</td>
                <td><span class="status-badge ${estadoClass}">${cobro.estado_cobro}</span></td>
                <td>${diasAtraso}</td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-action view-btn" title="Ver detalles"><i class="fas fa-eye"></i></button>
                        <button class="icon-action remind-btn" title="Enviar recordatorio"><i class="fab fa-whatsapp"></i></button>
                        <button class="icon-action edit-btn" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="icon-action receipt-btn" title="Generar recibo"><i class="fas fa-file-invoice"></i></button>
                    </div>
                </td>
            `;
            
            cobrosTable.appendChild(fila);
            
            // Configurar listeners para los botones de acción
            fila.querySelector('.view-btn').addEventListener('click', () => viewPaymentDetail(cobro.id));
            fila.querySelector('.remind-btn').addEventListener('click', () => whatsappModule.sendPaymentReminder(cobro.id, 'recordatorio'));
            fila.querySelector('.edit-btn').addEventListener('click', () => showPaymentModal(cobro.id));
            fila.querySelector('.receipt-btn').addEventListener('click', () => generateReceipt(cobro.id));
            
            // Actualizar estado de las acciones masivas cuando se marcan checkboxes
            fila.querySelector('.payment-checkbox').addEventListener('change', updateBulkActionsState);
        });
        
        updateBulkActionsState(); // Actualizar estado de los botones de acciones masivas
        console.log(`Tabla de cobros actualizada con ${cobrosArray.length} cobros.`);
        
        return cobrosArray;
    } catch (error) {
        console.error("Error cargando cobros:", error);
        cobrosTable.innerHTML = '<tr><td colspan="9" class="center-text error-text">Error al cargar cobros. Intente de nuevo.</td></tr>';
        throw error;
    }
}

/**
 * Muestra el modal para crear o editar un cobro
 * @param {number} cobroId - ID del cobro a editar (null para nuevo cobro)
 * @param {number} clienteId - ID del cliente preseleccionado (opcional)
 */
function showPaymentModal(cobroId = null, clienteId = null) {
    console.log(`Preparando modal cobro. ID: ${cobroId}, Cliente ID: ${clienteId}`);
    
    // Título según sea nuevo cobro o edición
    const title = cobroId ? 'Editar Cobro' : 'Registrar Nuevo Cobro';
    
    // Contenido del formulario
    const formHtml = `
        <form id="add-payment-form">
            <div class="form-group">
                <label for="payment-client">Cliente <span class="required">*</span></label>
                <select id="payment-client" name="cliente_id" required>
                    <option value="">-- Seleccione Cliente --</option>
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="payment-service">Servicio</label>
                    <select id="payment-service" name="servicio_id">
                        <option value="">-- Seleccione Servicio --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="payment-service-desc">Descripción Personalizada</label>
                    <input type="text" id="payment-service-desc" name="descripcion_servicio_personalizado" 
                           placeholder="Si no seleccionó un servicio del catálogo">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="payment-amount">Monto <span class="required">*</span></label>
                    <input type="number" id="payment-amount" name="monto" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label for="payment-currency">Moneda</label>
                    <select id="payment-currency" name="moneda">
                        <option value="PEN">PEN (S/)</option>
                        <option value="USD">USD ($)</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="payment-issue-date">Fecha de Emisión <span class="required">*</span></label>
                    <input type="date" id="payment-issue-date" name="fecha_emision" required>
                </div>
                <div class="form-group">
                    <label for="payment-due-date">Fecha de Vencimiento <span class="required">*</span></label>
                    <input type="date" id="payment-due-date" name="fecha_vencimiento" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="payment-status-modal">Estado</label>
                    <select id="payment-status-modal" name="estado_cobro">
                        <option value="Pendiente">Pendiente</option>
                        <option value="Pagado">Pagado</option>
                        <option value="Atrasado">Atrasado</option>
                        <option value="Anulado">Anulado</option>
                    </select>
                </div>
                <div class="form-group payment-paid-date-container" style="display: none;">
                    <label for="payment-paid-date">Fecha de Pago</label>
                    <input type="date" id="payment-paid-date" name="fecha_pago">
                </div>
            </div>
            <div class="form-row payment-paid-details" style="display: none;">
                <div class="form-group">
                    <label for="payment-method">Método de Pago</label>
                    <select id="payment-method" name="metodo_pago">
                        <option value="">-- Seleccione Método --</option>
                        <option value="Transferencia">Transferencia Bancaria</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Yape">Yape</option>
                        <option value="Plin">Plin</option>
                        <option value="Tarjeta">Tarjeta</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="payment-ref">Número de Referencia</label>
                    <input type="text" id="payment-ref" name="numero_referencia" 
                           placeholder="Número de operación o transacción">
                </div>
            </div>
            <div class="form-group">
                <label for="payment-notes">Notas</label>
                <textarea id="payment-notes" name="notas" rows="2"></textarea>
            </div>
        </form>
    `;
    
    // Opciones del modal
    const modalOptions = {
        size: 'normal',
        buttons: [
            { id: 'cancel-add-payment', text: 'Cancelar', type: 'secondary', action: 'close' },
            { id: 'save-add-payment', text: cobroId ? 'Actualizar Cobro' : 'Registrar Cobro', type: 'primary', action: () => savePayment(cobroId) }
        ]
    };
    
    // Crear el modal
    const modal = createModal('add-payment-modal', title, formHtml, modalOptions);
    
    // Configurar fechas por defecto
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('payment-issue-date').value = today;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    document.getElementById('payment-due-date').value = dueDate.toISOString().split('T')[0];
    
    // Configurar evento de cambio de estado
    const estadoSelect = document.getElementById('payment-status-modal');
    if (estadoSelect) {
        estadoSelect.addEventListener('change', function() {
            const esPagado = this.value === 'Pagado';
            document.querySelector('.payment-paid-date-container').style.display = esPagado ? 'block' : 'none';
            document.querySelector('.payment-paid-details').style.display = esPagado ? 'block' : 'none';
            
            if (esPagado && !document.getElementById('payment-paid-date').value) {
                document.getElementById('payment-paid-date').value = today;
            }
        });
    }
    
    // Cargar selects de clientes y servicios
    loadClientsAndServicesForSelects().then(() => {
        // Si se especificó un cliente, seleccionarlo
        if (clienteId) {
            const clientSelect = document.getElementById('payment-client');
            if (clientSelect) clientSelect.value = clienteId;
        }
    });
    
    // Si es edición, cargar datos del cobro
    if (cobroId) {
        showLoadingOverlay('Cargando datos del cobro...');
        
        apiFetch(`/cobros/${cobroId}`)
            .then(cobro => {
                document.getElementById('payment-client').value = cobro.cliente_id || '';
                document.getElementById('payment-service').value = cobro.servicio_id || '';
                document.getElementById('payment-service-desc').value = cobro.descripcion_servicio_personalizado || '';
                document.getElementById('payment-amount').value = parseFloat(cobro.monto || 0).toFixed(2);
                document.getElementById('payment-currency').value = cobro.moneda || 'PEN';
                document.getElementById('payment-issue-date').value = formatDateForInput(cobro.fecha_emision);
                document.getElementById('payment-due-date').value = formatDateForInput(cobro.fecha_vencimiento);
                document.getElementById('payment-status-modal').value = cobro.estado_cobro || 'Pendiente';
                document.getElementById('payment-notes').value = cobro.notas || '';
                
                document.getElementById('payment-paid-date').value = formatDateForInput(cobro.fecha_pago);
                document.getElementById('payment-method').value = cobro.metodo_pago || '';
                document.getElementById('payment-ref').value = cobro.numero_referencia || '';
                
                // Actualizar visibilidad de campos de pago
                const event = new Event('change');
                document.getElementById('payment-status-modal').dispatchEvent(event);
                
                hideLoadingOverlay();
            })
            .catch(error => {
                hideLoadingOverlay();
                showToast('Error', `No se pudo cargar datos: ${error.message}`, 'error');
                modal.remove();
            });
    } else {
        // Actualizar visibilidad de campos de pago
        const event = new Event('change');
        estadoSelect.dispatchEvent(event);
    }
    
    // Mostrar el modal
    modal.style.display = 'flex';
}

/**
 * Carga clientes y servicios para los selects del formulario
 */
async function loadClientsAndServicesForSelects() {
    try {
        await Promise.all([
            loadClientsForSelects(),
            loadServicesForSelects()
        ]);
    } catch (error) {
        console.error('Error cargando datos para selects:', error);
        showToast('Error', 'No se pudieron cargar los datos para los desplegables.', 'error');
    }
}

/**
 * Carga servicios para los selects de formularios
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
 * Carga clientes para los selects de formularios
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
 * Formatea una fecha para su uso en inputs de tipo date
 * @param {string} date - Fecha a formatear
 * @returns {string} - Fecha formateada (YYYY-MM-DD)
 */
function formatDateForInput(date) {
    if (!date) return '';
    
    try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        
        return dateObj.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
}

/**
 * Guarda los datos de un cobro (nuevo o editado)
 * @param {number} cobroId - ID del cobro (null para cobro nuevo)
 */
async function savePayment(cobroId) {
    const form = document.getElementById('add-payment-form');
    if (!form) {
        showToast('Error', 'Formulario no encontrado', 'error');
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const datosCobro = {};
    
    formData.forEach((value, key) => { 
        if (key === 'monto') {
            datosCobro[key] = parseFloat(value);
        } else if (key === 'activo') {
            datosCobro[key] = value === 'true';
        } else {
            datosCobro[key] = value || null;
        }
    });
    
    if (!datosCobro.cliente_id || !datosCobro.monto || !datosCobro.fecha_emision || !datosCobro.fecha_vencimiento) {
        showToast('Campos Requeridos', 'Cliente, Monto, Fechas son obligatorios.', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(cobroId ? 'Actualizando cobro...' : 'Guardando cobro...');
        
        let cobroResultado;
        
        if (cobroId) {
            // Actualizar cobro existente
            cobroResultado = await apiFetch(`/cobros/${cobroId}`, {
                method: 'PUT',
                body: datosCobro
            });
            showToast('Éxito', `Cobro ID ${cobroResultado.id} actualizado correctamente.`, 'success');
        } else {
            // Crear nuevo cobro
            cobroResultado = await apiFetch('/cobros', {
                method: 'POST',
                body: datosCobro
            });
            showToast('Éxito', `Cobro ID ${cobroResultado.id} registrado correctamente.`, 'success');
        }
        
        // Cerrar modal y recargar datos
        closeAllModals();
        loadPayments();
        
    } catch (error) {
        console.error('Error guardando cobro:', error);
        showToast('Error', error.data?.message || error.message || 'No se pudo guardar el cobro.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Muestra el detalle de un cobro
 * @param {number} cobroId - ID del cobro a ver
 */
async function viewPaymentDetail(cobroId) {
    console.log(`Viendo detalle de cobro ID: ${cobroId}`);
    
    try {
        showLoadingOverlay('Cargando detalle del cobro...');
        
        const cobro = await apiFetch(`/cobros/${cobroId}`);
        
        // Contenido del modal
        const detailHtml = `
            <div class="payment-detail-section">
                <h3>Información del Cobro</h3>
                <div class="detail-group">
                    <div class="detail-item">
                        <span class="detail-label">Cliente:</span>
                        <span class="detail-value">${cobro.cliente?.nombre_cliente || 'No asignado'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Servicio:</span>
                        <span class="detail-value">${cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'No especificado'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Monto:</span>
                        <span class="detail-value">${formatCurrency(cobro.monto || 0, cobro.moneda || 'PEN')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Estado:</span>
                        <span class="detail-value status-badge ${formatStatusBadge(cobro.estado_cobro)}">${cobro.estado_cobro}</span>
                    </div>
                </div>
            </div>
            
            <div class="payment-detail-section">
                <h3>Fechas</h3>
                <div class="detail-group">
                    <div class="detail-item">
                        <span class="detail-label">Emisión:</span>
                        <span class="detail-value">${formatDate(cobro.fecha_emision, 'medium')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Vencimiento:</span>
                        <span class="detail-value">${formatDate(cobro.fecha_vencimiento, 'medium')}</span>
                    </div>
                    ${cobro.fecha_pago ? `
                    <div class="detail-item">
                        <span class="detail-label">Pago:</span>
                        <span class="detail-value">${formatDate(cobro.fecha_pago, 'medium')}</span>
                    </div>` : ''}
                </div>
            </div>
            
            ${cobro.estado_cobro === 'Pagado' ? `
            <div class="payment-detail-section">
                <h3>Información de Pago</h3>
                <div class="detail-group">
                    <div class="detail-item">
                        <span class="detail-label">Método:</span>
                        <span class="detail-value">${cobro.metodo_pago || 'No especificado'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Referencia:</span>
                        <span class="detail-value">${cobro.numero_referencia || 'No especificado'}</span>
                    </div>
                </div>
            </div>` : ''}
            
            ${cobro.notas ? `
            <div class="payment-detail-section">
                <h3>Notas</h3>
                <p class="payment-notes">${cobro.notas}</p>
            </div>` : ''}
        `;
        
        // Opciones del modal
        const modalOptions = {
            size: 'normal',
            buttons: [
                { id: 'close-detail-modal', text: 'Cerrar', type: 'secondary', action: 'close' }
            ]
        };
        
        // Si no está pagado, agregar botón para marcar como pagado
        if (cobro.estado_cobro !== 'Pagado') {
            modalOptions.buttons.push({
                id: 'mark-as-paid-btn',
                text: 'Marcar como Pagado',
                type: 'primary',
                action: () => markAsPaid(cobroId)
            });
        }
        
        // Crear y mostrar el modal
        const modal = createModal('view-payment-modal', `Detalle de Cobro #${cobroId}`, detailHtml, modalOptions);
        modal.style.display = 'flex';
        
        hideLoadingOverlay();
        
    } catch (error) {
        hideLoadingOverlay();
        console.error(`Error cargando detalle del cobro ${cobroId}:`, error);
        showToast('Error', 'No se pudo cargar el detalle del cobro.', 'error');
    }
}

/**
 * Marca un cobro como pagado
 * @param {number} cobroId - ID del cobro
 */
async function markAsPaid(cobroId) {
    if (confirm('¿Marcar este cobro como pagado? Esta acción registrará la fecha de pago actual.')) {
        try {
            showLoadingOverlay('Actualizando estado del cobro...');
            
            const today = new Date().toISOString().split('T')[0];
            
            await apiFetch(`/cobros/${cobroId}`, {
                method: 'PUT',
                body: {
                    estado_cobro: 'Pagado',
                    fecha_pago: today
                }
            });
            
            showToast('Cobro Actualizado', 'Cobro marcado como pagado correctamente.', 'success');
            closeAllModals();
            
            // Recargar datos
            loadPayments();
            
        } catch (error) {
            console.error('Error marcando cobro como pagado:', error);
            showToast('Error', error.data?.message || error.message || 'Error al actualizar el cobro.', 'error');
        } finally {
            hideLoadingOverlay();
        }
    }
}

/**
 * Genera un recibo para un cobro
 * @param {number} cobroId - ID del cobro
 */
async function generateReceipt(cobroId) {
    console.log(`Generando recibo para cobro ID: ${cobroId}`);
    
    showLoadingOverlay('Generando recibo...');
    
    try {
        const cobro = await apiFetch(`/cobros/${cobroId}`);
        
        if (cobro.estado_cobro !== 'Pagado') {
            hideLoadingOverlay();
            
            if (confirm('Este cobro no está marcado como pagado. ¿Desea marcarlo como pagado antes de generar el recibo?')) {
                // Marcar como pagado y luego generar recibo
                const today = new Date().toISOString().split('T')[0];
                
                await apiFetch(`/cobros/${cobroId}`, {
                    method: 'PUT',
                    body: {
                        estado_cobro: 'Pagado',
                        fecha_pago: today
                    }
                });
                
                showToast('Cobro Actualizado', 'Cobro marcado como pagado correctamente.', 'success');
                
                // Recargar datos y mostrar recibo
                loadPayments();
                generateReceipt(cobroId);
            }
            
            return;
        }
        
        // Cargar configuraciones de la empresa
        const settings = await apiFetch('/settings');
        
        // Crear el contenido del recibo
        const receiptHtml = `
            <div class="receipt-header">
                <div class="receipt-logo">
                    <img src="${settings.logo_url || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNDY1IDEwMjQiPjxzdHlsZT4uc3QwLC5zdDF7ZmlsbDojNGE2ZGE3fTwvc3R5bGU+PHBhdGggY2xhc3M9InN0MCIgZD0iTTY0MyAyMDhoNTIzdjY0SDY0M3oiLz48cGF0aCBjbGFzcz0ic3QwIiBkPSJNNjQzIDI0MGgzNTJWMzA0SDY0M3pNNjQzIDMwNGgzNTJWMzY4SDY0M3pNOTk1IDQzMmgxNzF2NjRIOTk1ek03MTUgNDMyaDE3MXY2NEg3MTV6TTY0MyA0OTZoMzUyVjU2MEg2NDN6TTY0MyA1NjBoNTIzdjY0SDY0M3pNNzE1IDYyNGgyNzl2NjRINzE1eiIvPjxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0zMTEgNjA2czE1OC0xMzQgMjkwIDE4YzE1MyA0Ni04MSAxMTgtODEgMTE4cy0xNTQgNzYtMjM5LTUyYy0zNi02OCAxOS0xMTEgMzAtODR6Ii8+PHBhdGggY2xhc3M9InN0MCIgZD0iTTQ4MiA1MDYgMzExIDYwNnMxMDAtNDIgMTcxLTEwMHoiLz48cGF0aCBjbGFzcz0ic3QxIiBkPSJNNjg1IDU3OXMxNTgtMTM0IDI5MCAxOGMxNTMgNDYtODEgMTE4LTgxIDExOHMtMTU0IDc2LTIzOS01MmMtMzYtNjggMTktMTExIDMwLTg0eiIvPjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04NTYgNDc5IDY4NSA1Nzlz MTAwLTQyIDE3MS0xMDB6Ii8+PHBhdGggY2xhc3M9InN0MSIgZD0iTTQ5OCA3OTBzMTU4LTEzNCAyOTAgMThjMTUzIDQ2LTgxIDExOC04MSAxMThzLTE1NCA3Ni0yMzktNTJjLTM2LTY4IDE5LTExMSAzMC04NHoiLz48cGF0aCBjbGFzcz0ic3QwIiBkPSJNNjY5IDY5MCA0OTggNzkwczEwMC00MiAxNzEtMTAweiIvPjwvc3ZnPg=='}" alt="PEGASUS Logo" id="receipt-logo-img">
                    <h1>${settings.empresa_nombre || 'PEGASUS S.A.C.'}</h1>
                </div>
                <div class="receipt-info">
                    <p><strong>RECIBO DE PAGO</strong></p>
                    <p>#${cobro.id}</p>
                    <p>Fecha: ${formatDate(cobro.fecha_pago || new Date(), 'medium')}</p>
                </div>
            </div>
            <div class="receipt-client">
                <h2>Cliente</h2>
                <p><strong>Nombre:</strong> ${cobro.cliente?.nombre_cliente || 'Cliente no asignado'}</p>
                <p><strong>RUC/DNI:</strong> ${cobro.cliente?.ruc_dni || 'No registrado'}</p>
                <p><strong>Dirección:</strong> ${cobro.cliente?.direccion || 'No registrada'}</p>
            </div>
            <div class="receipt-details">
                <h2>Detalle del Pago</h2>
                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th>Descripción</th>
                            <th>Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Servicio</td>
                            <td>${cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'No especificado'}</td>
                            <td>${formatCurrency(cobro.monto || 0, cobro.moneda || 'PEN')}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="right-align"><strong>Total Pagado:</strong></td>
                            <td><strong>${formatCurrency(cobro.monto || 0, cobro.moneda || 'PEN')}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                <div class="receipt-payment-info">
                    <p><strong>Método de Pago:</strong> ${cobro.metodo_pago || 'No especificado'}</p>
                    <p><strong>Referencia:</strong> ${cobro.numero_referencia || 'No especificado'}</p>
                    <p><strong>Fecha de Emisión:</strong> ${formatDate(cobro.fecha_emision, 'medium')}</p>
                    <p><strong>Fecha de Pago:</strong> ${formatDate(cobro.fecha_pago || new Date(), 'medium')}</p>
                </div>
            </div>
            <div class="receipt-footer">
                <div class="receipt-notes">
                    ${cobro.notas ? `<p><strong>Notas:</strong> ${cobro.notas}</p>` : ''}
                    <p>¡Gracias por su preferencia!</p>
                </div>
                <div class="receipt-contact">
                    <p>${settings.empresa_direccion || 'Av. Principal 123, Lima'}</p>
                    <p>${settings.empresa_telefono || '+51 123456789'} • ${settings.empresa_correo || 'info@pegasus.com'}</p>
                </div>
            </div>
        `;
        
        // Opciones del modal
        const modalOptions = {
            size: 'normal',
            buttons: [
                { id: 'close-receipt', text: 'Cerrar', type: 'secondary', action: 'close' },
                { id: 'send-receipt-whatsapp', text: 'Enviar por WhatsApp', type: 'primary', action: () => {
                    closeAllModals();
                    whatsappModule.sendPaymentReminder(cobroId, 'recibo');
                }}
            ]
        };
        
        // Crear y mostrar el modal
        const modal = createModal('receipt-modal', 'Recibo de Pago', receiptHtml, modalOptions);
        
        // Agregar botones adicionales en el header
        const modalHeader = modal.querySelector('.modal-header');
        if (modalHeader) {
            const headerActions = document.createElement('div');
            headerActions.className = 'modal-header-actions';
            headerActions.innerHTML = `
                <button class="icon-btn" id="print-receipt"><i class="fas fa-print"></i></button>
                <button class="icon-btn" id="download-receipt"><i class="fas fa-download"></i></button>
                <button class="icon-btn" id="share-receipt"><i class="fas fa-share-alt"></i></button>
            `;
            modalHeader.appendChild(headerActions);
            
            // Configurar listeners
            modal.querySelector('#print-receipt').addEventListener('click', () => window.print());
            modal.querySelector('#download-receipt').addEventListener('click', () => downloadReceipt(cobroId));
            modal.querySelector('#share-receipt').addEventListener('click', () => shareReceipt(cobroId));
        }
        
        // Guardar el ID del cobro en el recibo para futuras acciones
        const receiptContent = modal.querySelector('.modal-body');
        if (receiptContent) {
            receiptContent.dataset.cobroId = cobroId;
        }
        
        hideLoadingOverlay();
    } catch (error) {
        hideLoadingOverlay();
        console.error(`Error generando recibo para cobro ${cobroId}:`, error);
        showToast('Error', 'No se pudo generar el recibo.', 'error');
    }
}

/**
 * Descarga un recibo como archivo
 * @param {number} cobroId - ID del cobro
 */
function downloadReceipt(cobroId) {
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) {
        showToast('Error', 'No se pudo generar el contenido del recibo.', 'error');
        return;
    }
    
    const contenido = modalBody.innerHTML;
    const blob = new Blob([`
        <html>
            <head>
                <title>Recibo PEGASUS</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .receipt-container { padding: 20px; }
                    .receipt-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .receipt-logo { display: flex; align-items: center; }
                    .receipt-logo img { height: 60px; margin-right: 10px; }
                    .receipt-logo h1 { margin: 0; color: #4a6da7; }
                    .receipt-info { text-align: right; }
                    .receipt-client, .receipt-details { margin-bottom: 20px; }
                    .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .receipt-table th, .receipt-table td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }
                    .receipt-table th { background-color: #f8f9fa; }
                    .receipt-table tfoot { font-weight: bold; }
                    .right-align { text-align: right; }
                    .receipt-payment-info { margin-bottom: 20px; }
                    .receipt-footer { display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="receipt-container">${contenido}</div>
            </body>
        </html>
    `], { type: 'text/html' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo-pegasus-${cobroId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Recibo Descargado', 'Recibo descargado correctamente.', 'success');
}

/**
 * Comparte un recibo usando la API Web Share si está disponible
 * @param {number} cobroId - ID del cobro
 */
function shareReceipt(cobroId) {
    if (navigator.share) {
        navigator.share({
            title: `Recibo PEGASUS #${cobroId}`,
            text: 'Comparto este recibo de pago de PEGASUS'
        })
        .then(() => showToast('Compartido', 'Recibo compartido exitosamente', 'success'))
        .catch((error) => console.error('Error al compartir:', error));
    } else {
        showToast('No Soportado', 'Tu navegador no soporta compartir contenido', 'warning');
    }
}

/**
 * Elimina un cobro
 * @param {number} cobroId - ID del cobro a eliminar
 */
async function deletePayment(cobroId) {
    if (!confirm('¿Está seguro de eliminar este cobro? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        showLoadingOverlay('Eliminando cobro...');
        
        await apiFetch(`/cobros/${cobroId}`, {
            method: 'DELETE'
        });
        
        showToast('Cobro Eliminado', 'Cobro eliminado correctamente.', 'success');
        loadPayments();
        
    } catch (error) {
        console.error(`Error eliminando cobro ${cobroId}:`, error);
        
        let mensaje = 'No se pudo eliminar el cobro.';
        if (error.data?.message) {
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
    initPayments,
    setupPaymentFilters,
    loadPayments,
    loadServicesForSelects,
    showPaymentModal,
    viewPaymentDetail,
    generateReceipt,
    markAsPaid,
    deletePayment
};