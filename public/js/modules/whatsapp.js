/**
 * whatsapp.js
 * Módulo para gestionar la integración con WhatsApp
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { createModal, closeAllModals } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatting.js';

/**
 * Inicializa el módulo de WhatsApp
 */
function initWhatsApp() {
    console.log('Inicializando módulo de WhatsApp...');
    
    // Configurar botones de conexión
    const connectBtn = document.getElementById('whatsapp-connect-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', showConnectWhatsAppModal);
    }
}

/**
 * Muestra el modal para conectar o editar credenciales de WhatsApp
 * @param {boolean} isEdit - Si es para editar credenciales existentes
 */
function showConnectWhatsAppModal(isEdit = false) {
    console.log('Mostrando modal para configurar WhatsApp');
    
    const title = isEdit ? 'Editar Credenciales de WhatsApp Business API' : 'Conectar WhatsApp Business API';
    
    const modalHtml = `
        <div class="whatsapp-connect-form">
            <p class="info-text">
                Para utilizar la integración con WhatsApp Business API, necesitas proporcionar 
                las credenciales de tu cuenta de WhatsApp Business.
            </p>
            
            <div class="form-group">
                <label for="whatsapp-phone-id">Phone Number ID <span class="required">*</span></label>
                <input type="text" id="whatsapp-phone-id" name="phoneNumberId" 
                       placeholder="Ej: 123456789012345" required>
                <small>ID de tu número de teléfono en WhatsApp Business API</small>
            </div>
            
            <div class="form-group">
                <label for="whatsapp-token">Access Token <span class="required">*</span></label>
                <input type="password" id="whatsapp-token" name="accessToken" required>
                <small>Token de acceso permanente de WhatsApp Business API</small>
            </div>
            
            <div class="form-group">
                <label for="whatsapp-api-url">API URL (opcional)</label>
                <input type="text" id="whatsapp-api-url" name="apiUrl" 
                       placeholder="https://graph.facebook.com/v17.0">
                <small>URL base de la API de WhatsApp</small>
            </div>
            
            <p class="help-text">
                <i class="fas fa-info-circle"></i> 
                Puedes obtener estas credenciales desde el panel de desarrollador de Meta para WhatsApp Business API.
            </p>
        </div>
    `;
    
    const modalOptions = {
        size: 'normal',
        buttons: [
            { id: 'cancel-whatsapp-connect', text: 'Cancelar', type: 'secondary', action: 'close' },
            { id: 'submit-whatsapp-connect', text: isEdit ? 'Actualizar Credenciales' : 'Conectar WhatsApp', type: 'primary', action: connectWhatsApp }
        ]
    };
    
    // Cerrar modales anteriores
    closeAllModals();
    
    // Crear y mostrar el modal
    const modal = createModal('whatsapp-connect-modal', title, modalHtml, modalOptions);
    modal.style.display = 'flex';
    
    // Si ya existe una configuración, intentar cargar los valores actuales
    loadCurrentWhatsAppConfig();
}

/**
 * Intenta cargar la configuración actual de WhatsApp en el formulario
 */
async function loadCurrentWhatsAppConfig() {
    try {
        const status = await apiFetch('/settings/whatsapp/status');
        
        if (status && status.status === 'connected') {
            const phoneIdInput = document.getElementById('whatsapp-phone-id');
            if (phoneIdInput && status.phoneId) {
                phoneIdInput.value = status.phoneId;
            }
            
            const apiUrlInput = document.getElementById('whatsapp-api-url');
            if (apiUrlInput && status.apiUrl) {
                apiUrlInput.value = status.apiUrl;
            }
            
            // No podemos cargar el token porque normalmente no se devuelve por seguridad
            document.getElementById('whatsapp-token').placeholder = '••••••••••••••••••••••••••••••';
        }
    } catch (error) {
        console.error('Error cargando configuración actual de WhatsApp:', error);
    }
}

/**
 * Conecta con la API de WhatsApp
 */
async function connectWhatsApp() {
    const phoneNumberId = document.getElementById('whatsapp-phone-id')?.value;
    const accessToken = document.getElementById('whatsapp-token')?.value;
    const apiUrl = document.getElementById('whatsapp-api-url')?.value;
    
    if (!phoneNumberId || !accessToken) {
        showToast('Error', 'Debe proporcionar Phone Number ID y Access Token', 'error');
        return;
    }
    
    try {
        showLoadingOverlay('Conectando con WhatsApp Business API...');
        
        const response = await apiFetch('/settings/whatsapp/connect', {
            method: 'POST',
            body: {
                phoneNumberId,
                accessToken,
                apiUrl: apiUrl || undefined
            }
        });
        
        closeAllModals();
        
        showToast('Conexión Exitosa', 
                 `WhatsApp Business conectado correctamente como ${response.number || 'WhatsApp Business'}`, 
                 'success');
        
        // Recargar la página para actualizar el estado
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        hideLoadingOverlay();
        
        const errorMsg = error.data?.message || error.message || 'Error al conectar con WhatsApp';
        showToast('Error de Conexión', errorMsg, 'error');
        
        console.error('Error conectando WhatsApp:', error);
    }
}

/**
 * Envía un recordatorio de pago a un cliente
 * @param {number} clienteId - ID del cliente
 */
async function sendClientReminder(clienteId) {
    console.log(`Abriendo modal de recordatorio para cliente ID: ${clienteId}`);
    
    showLoadingOverlay('Cargando datos del cliente...');
    
    // Obtener datos del cliente y sus cobros pendientes
    try {
        const [cliente, cobros] = await Promise.all([
            apiFetch(`/clientes/${clienteId}`),
            apiFetch(`/cobros?clienteId=${clienteId}&estado=Pendiente`)
        ]);
        
        const cobrosArray = Array.isArray(cobros) ? cobros : cobros.cobros || [];
        
        if (!cliente.telefono) {
            hideLoadingOverlay();
            showToast('Sin Teléfono', 'El cliente no tiene número de teléfono registrado.', 'warning');
            
            if (confirm('¿Desea agregar un número de teléfono a este cliente ahora?')) {
                // Importar de forma dinámica para evitar dependencias circulares
                import('./clients.js').then(clientsModule => {
                    clientsModule.showClientModal(clienteId);
                });
            }
            
            return;
        }
        
        if (cobrosArray.length === 0) {
            hideLoadingOverlay();
            showToast('Sin Cobros Pendientes', 'El cliente no tiene cobros pendientes para recordar.', 'info');
            return;
        }
        
        // Verificar status de WhatsApp
        const status = await apiFetch('/settings/whatsapp/status');
        
        if (status.status !== 'connected') {
            hideLoadingOverlay();
            showToast('WhatsApp No Conectado', 'Debe conectar WhatsApp antes de enviar mensajes.', 'warning');
            
            // Redirigir a la sección de configuración de WhatsApp
            document.querySelector('.nav-menu li[data-page="settings"]')?.click();
            const whatsappSettingsTab = document.querySelector('.settings-menu li[data-settings="whatsapp"]');
            if (whatsappSettingsTab) {
                setTimeout(() => whatsappSettingsTab.click(), 500);
            }
            
            return;
        }
        
        // Crear modal de recordatorio
        const modalHtml = `
            <div class="notification-recipient">
                <h3>Destinatario</h3>
                <div class="notification-client-info">
                    <div class="client-info">
                        <div class="client-avatar">${cliente.nombre_cliente.charAt(0).toUpperCase()}</div>
                        <div>
                            <p class="client-name">${cliente.nombre_cliente}</p>
                            <p class="client-phone">${cliente.telefono}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="reminder-cobro">Cobro a Recordar</label>
                <select id="reminder-cobro">
                    <option value="all">Todos los cobros pendientes (${cobrosArray.length})</option>
                    ${cobrosArray.map(cobro => `
                        <option value="${cobro.id}">
                            Cobro #${cobro.id} - ${cobro.moneda || 'PEN'} ${parseFloat(cobro.monto || 0).toFixed(2)} - Vence: ${new Date(cobro.fecha_vencimiento).toLocaleDateString('es-ES')}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label for="reminder-template">Plantilla</label>
                <select id="reminder-template">
                    <option value="payment-reminder">Recordatorio de Pago</option>
                    <option value="overdue-reminder">Recordatorio de Atraso</option>
                    <option value="custom">Mensaje Personalizado</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="reminder-message">Mensaje</label>
                <textarea id="reminder-message" rows="5"></textarea>
            </div>
        `;
        
        // Opciones del modal
        const modalOptions = {
            size: 'normal',
            buttons: [
                { id: 'cancel-reminder', text: 'Cancelar', type: 'secondary', action: 'close' },
                { id: 'send-reminder-whatsapp', text: 'Enviar por WhatsApp', type: 'primary', action: async () => {
                    // Obtener datos del formulario
                    const mensaje = document.getElementById('reminder-message')?.value.trim();
                    const cobroId = document.getElementById('reminder-cobro')?.value;
                    const templateType = document.getElementById('reminder-template')?.value;
                    
                    if (!mensaje) {
                        showToast('Error', 'El mensaje no puede estar vacío.', 'error');
                        return;
                    }
                    
                    // Enviar mensaje
                    await sendWhatsAppMessage(cliente.id, mensaje, templateType, cobroId !== 'all' ? cobroId : null);
                    closeAllModals();
                }}
            ]
        };
        
        // Crear el modal
        const modal = createModal('client-reminder-modal', 'Enviar Recordatorio a Cliente', modalHtml, modalOptions);
        
        // Configurar mensaje inicial
        const cobroSelect = document.getElementById('reminder-cobro');
        const templateSelect = document.getElementById('reminder-template');
        const messageTextarea = document.getElementById('reminder-message');
        
        if (cobroSelect && templateSelect && messageTextarea) {
            const updateMessage = () => {
                const cobroId = cobroSelect.value;
                const templateValue = templateSelect.value;
                
                let cobro;
                if (cobroId === 'all') {
                    cobro = {
                        cliente: { nombre_cliente: cliente.nombre_cliente },
                        monto: cobrosArray.reduce((sum, c) => sum + parseFloat(c.monto || 0), 0),
                        descripcion_servicio_personalizado: `${cobrosArray.length} servicios pendientes`,
                        fecha_vencimiento: cobrosArray.sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0]?.fecha_vencimiento
                    };
                } else {
                    cobro = cobrosArray.find(c => c.id.toString() === cobroId);
                    cobro.cliente = { nombre_cliente: cliente.nombre_cliente };
                }
                
                updateNotificationMessage(templateValue, messageTextarea, {
                    nombreCliente: cobro.cliente.nombre_cliente,
                    monto: cobro.monto,
                    nombreServicio: cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'servicios contratados',
                    fechaVencimiento: cobro.fecha_vencimiento
                });
            };
            
            cobroSelect.addEventListener('change', updateMessage);
            templateSelect.addEventListener('change', updateMessage);
            
            // Establecer mensaje inicial
            updateMessage();
        }
        
        // Mostrar el modal
        modal.style.display = 'flex';
        
        hideLoadingOverlay();
    } catch (error) {
        hideLoadingOverlay();
        console.error(`Error cargando datos para recordatorio de cliente ${clienteId}:`, error);
        showToast('Error', 'No se pudieron cargar los datos del cliente.', 'error');
    }
}

/**
 * Envía un recordatorio para un cobro específico
 * @param {number} cobroId - ID del cobro
 * @param {string} tipo - Tipo de recordatorio ('recordatorio', 'recibo', 'agradecimiento')
 */
async function sendPaymentReminder(cobroId, tipo = 'recordatorio') {
    console.log(`Preparando envío de notificación WhatsApp para cobro ID: ${cobroId}, tipo: ${tipo}`);
    
    try {
        // Verificar status de WhatsApp
        const status = await apiFetch('/settings/whatsapp/status');
        
        if (status.status !== 'connected') {
            showToast('WhatsApp No Conectado', 'Debe conectar WhatsApp antes de enviar mensajes.', 'warning');
            
            // Redirigir a la sección de configuración de WhatsApp
            document.querySelector('.nav-menu li[data-page="settings"]')?.click();
            const whatsappSettingsTab = document.querySelector('.settings-menu li[data-settings="whatsapp"]');
            if (whatsappSettingsTab) {
                setTimeout(() => whatsappSettingsTab.click(), 500);
            }
            
            return;
        }
        
        // Obtener datos del cobro
        const cobro = await apiFetch(`/cobros/${cobroId}`);
        
        // Verificar si el cliente tiene teléfono
        if (!cobro.cliente?.telefono) {
            showToast('Sin Teléfono', 'El cliente no tiene número de teléfono registrado.', 'warning');
            
            if (confirm('¿Desea agregar un número de teléfono a este cliente ahora?')) {
                // Importar de forma dinámica para evitar dependencias circulares
                import('./clients.js').then(clientsModule => {
                    clientsModule.showClientModal(cobro.cliente.id);
                });
            }
            
            return;
        }
        
        // Crear modal de notificación
        const modalHtml = `
            <div class="notification-recipient">
                <h3>Destinatario</h3>
                <div class="notification-client-info">
                    <div class="client-info">
                        <div class="client-avatar" id="notification-client-avatar">${cobro.cliente.nombre_cliente.charAt(0).toUpperCase()}</div>
                        <div>
                            <p class="client-name" id="notification-client-name">${cobro.cliente.nombre_cliente}</p>
                            <p class="client-phone" id="notification-client-phone">${cobro.cliente.telefono}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label for="notification-template">Plantilla</label>
                <select id="notification-template">
                    <option value="payment-reminder">Recordatorio de Pago</option>
                    <option value="overdue-reminder">Recordatorio de Atraso</option>
                    <option value="payment-receipt">Comprobante de Pago</option>
                    <option value="custom">Mensaje Personalizado</option>
                </select>
            </div>
            <div class="form-group">
                <label for="notification-message">Mensaje</label>
                <textarea id="notification-message" rows="6"></textarea>
            </div>
        `;
        
        // Opciones del modal
        const modalOptions = {
            size: 'normal',
            buttons: [
                { id: 'cancel-notification', text: 'Cancelar', type: 'secondary', action: 'close' },
                { id: 'send-notification-whatsapp', text: 'Enviar por WhatsApp', type: 'primary', action: async () => {
                    // Obtener datos del formulario
                    const mensaje = document.getElementById('notification-message')?.value.trim();
                    const templateType = document.getElementById('notification-template')?.value;
                    
                    if (!mensaje) {
                        showToast('Error', 'El mensaje no puede estar vacío.', 'error');
                        return;
                    }
                    
                    // Enviar mensaje
                    await sendWhatsAppMessage(cobro.cliente.id, mensaje, templateType, cobroId);
                }}
            ]
        };
        
        // Crear y mostrar el modal
        const modal = createModal('notification-modal', 'Enviar Notificación WhatsApp', modalHtml, modalOptions);
        
        // Seleccionar la plantilla apropiada según el tipo de mensaje
        const templateSelect = document.getElementById('notification-template');
        const messageTextarea = document.getElementById('notification-message');
        
        if (templateSelect && messageTextarea) {
            // Función para actualizar mensaje
            const updateMessage = () => {
                updateNotificationMessage(templateSelect.value, messageTextarea, {
                    nombreCliente: cobro.cliente?.nombre_cliente,
                    monto: cobro.monto,
                    nombreServicio: cobro.servicio?.nombre_servicio || cobro.descripcion_servicio_personalizado || 'servicio contratado',
                    fechaVencimiento: cobro.fecha_vencimiento
                });
            };
            
            // Configurar eventos para actualizar mensaje
            templateSelect.addEventListener('change', updateMessage);
            
            // Seleccionar plantilla según el tipo
            switch (tipo) {
                case 'recordatorio':
                    templateSelect.value = cobro.estado_cobro === 'Atrasado' ? 'overdue-reminder' : 'payment-reminder';
                    break;
                case 'recibo':
                    templateSelect.value = 'payment-receipt';
                    break;
                default:
                    templateSelect.value = 'payment-reminder';
            }
            
            // Actualizar mensaje
            updateMessage();
        }
        
        // Mostrar el modal
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error preparando envío de WhatsApp:', error);
        showToast('Error', error.data?.message || error.message || 'Error al preparar mensaje WhatsApp.', 'error');
    }
}

/**
 * Actualiza el mensaje de notificación según la plantilla seleccionada
 * @param {string} templateValue - Plantilla seleccionada
 * @param {HTMLTextAreaElement} messageElement - Elemento textarea para el mensaje
 * @param {Object} data - Datos para rellenar la plantilla
 */
function updateNotificationMessage(templateValue, messageElement, data = {}) {
    const clientName = data.nombreCliente || "[Nombre Cliente]";
    const amount = data.monto ? formatCurrency(data.monto) : "[MONTO]";
    const service = data.nombreServicio || "[Servicio Contratado]";
    const dueDate = data.fechaVencimiento ? new Date(data.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-ES') : "[FECHA VENC.]";
    
    // Calcular días de atraso
    let delay = "[XX días]";
    if (data.fechaVencimiento) {
        try {
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            const venc = new Date(data.fechaVencimiento + 'T00:00:00');
            venc.setHours(0,0,0,0);
            
            if (hoy > venc) {
                const diffTime = Math.abs(hoy - venc);
                delay = `${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} día(s)`;
            } else {
                delay = 'Aún no vence';
            }
        } catch(e) {
            console.error("Error calculando delay", e);
            delay = "[Error Fecha]";
        }
    }
    
    // Seleccionar plantilla
    let message = '';
    switch (templateValue) {
        case 'payment-reminder':
            message = `Estimado cliente ${clientName}, le recordamos amablemente sobre su pago pendiente de ${amount} por ${service}, con vencimiento el ${dueDate}. Agradeceremos su pronta gestión. Atte. Pegasus.`;
            break;
        case 'overdue-reminder':
            message = `Estimado cliente ${clientName}, hemos notado que su pago de ${amount} por ${service} (vencido el ${dueDate}) tiene un atraso de ${delay}. Le solicitamos regularizarlo a la brevedad. Contáctenos si necesita ayuda. Atte. Pegasus.`;
            break;
        case 'payment-receipt':
            message = `Estimado cliente ${clientName}, le enviamos su recibo por el pago de ${amount} del servicio de ${service}. Gracias por su preferencia. Atte. Pegasus.`;
            break;
        case 'custom':
            message = '';
            break;
        default:
            message = `Recordatorio para ${clientName} sobre pago de ${amount}. Vence: ${dueDate}.`;
    }
    
    // Actualizar mensaje
    messageElement.value = message;
}

/**
 * Envía un mensaje de WhatsApp
 * @param {number} clienteId - ID del cliente
 * @param {string} mensaje - Mensaje a enviar
 * @param {string} tipo - Tipo de mensaje
 * @param {number} cobroId - ID del cobro (opcional)
 */
async function sendWhatsAppMessage(clienteId, mensaje, tipo, cobroId = null) {
    console.log(`Enviando mensaje WhatsApp a cliente ${clienteId}, tipo ${tipo}`);
    
    try {
        showLoadingOverlay('Enviando mensaje a WhatsApp...');
        
        // Datos para enviar
        const requestData = {
            clienteId,
            mensaje,
            tipo: tipo || 'recordatorio'
        };
        
        // Agregar ID de cobro si existe
        if (cobroId) {
            requestData.cobroId = cobroId;
        }
        
        // Enviar mensaje
        const response = await apiFetch('/settings/whatsapp/notify', {
            method: 'POST',
            body: requestData
        });
        
        showToast('Mensaje Enviado', 'Notificación enviada correctamente.', 'success');
        
        // Cerrar cualquier modal abierto después de enviar
        closeAllModals();
        
        return response;
    } catch (error) {
        console.error('Error enviando mensaje WhatsApp:', error);
        showToast('Error', error.data?.message || error.message || 'Error al enviar mensaje.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Obtiene el estado de WhatsApp
 * @returns {Promise<Object>} - Estado de WhatsApp
 */
async function getWhatsAppStatus() {
    try {
        const status = await apiFetch('/settings/whatsapp/status');
        return status;
    } catch (error) {
        console.error('Error obteniendo estado de WhatsApp:', error);
        showToast('Error', 'No se pudo obtener el estado de WhatsApp.', 'error');
        throw error;
    }
}

export {
    initWhatsApp,
    sendClientReminder,
    sendPaymentReminder,
    sendWhatsAppMessage,
    updateNotificationMessage,
    getWhatsAppStatus,
    showConnectWhatsAppModal,
    connectWhatsApp
};