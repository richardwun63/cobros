/**
 * settings.js
 * Módulo para gestionar la configuración del sistema
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { createModal, closeAllModals } from '../utils/modal.js';
import { formatDate } from '../utils/formatting.js';
import * as usersModule from './users.js';

/**
 * Inicializa el módulo de configuración
 */
async function initSettings() {
    console.log('Inicializando módulo de Configuración...');
    
    // Configurar listeners para las pestañas de configuración
    setupSettingsTabs();
    
    // Configurar formularios
    setupSettingsForms();
    
    // Cargar configuraciones iniciales
    await loadSettings();
}

/**
 * Configura las pestañas de configuración
 */
function setupSettingsTabs() {
    const settingsMenuItems = document.querySelectorAll('.settings-menu li[data-settings]');
    settingsMenuItems.forEach(item => {
        if (item.dataset.listenerAttached === 'true') return;
        item.dataset.listenerAttached = 'true';
        
        item.addEventListener('click', function() {
            // Verificar si es pestaña de admin y usuario no es admin
            const userRole = sessionStorage.getItem('loggedInRole');
            if (this.classList.contains('admin-only') && userRole !== 'Administrador') {
                showToast('Acceso Denegado', 'No tienes permisos para esta sección.', 'warning');
                return;
            }
            
            // Actualizar pestañas activas
            settingsMenuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Mostrar panel correspondiente
            const settingsId = this.getAttribute('data-settings');
            showSettingsPanel(settingsId);
        });
    });
}

/**
 * Muestra un panel de configuración específico
 * @param {string} settingsId - ID del panel a mostrar
 */
function showSettingsPanel(settingsId) {
    console.log(`Mostrando panel de settings: ${settingsId}`);
    
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
    
    const selectedPanel = document.getElementById(`${settingsId}-settings`);
    if (selectedPanel) {
        selectedPanel.classList.add('active');
        
        // Cargar datos específicos del panel
        switch (settingsId) {
            case 'users':
                // Asegurarse de que el panel de usuarios tenga la estructura correcta
                preparaUsersPanel(selectedPanel);
                usersModule.loadUsers();
                break;
            case 'whatsapp':
                loadWhatsAppStatus();
                break;
            case 'backup':
                loadBackupsList();
                break;
        }
    } else {
        console.warn(`Panel de configuración con ID "${settingsId}-settings" no encontrado.`);
        document.getElementById('general-settings')?.classList.add('active');
        document.querySelector('.settings-menu li[data-settings="general"]')?.classList.add('active');
    }
}

/**
 * Prepara el panel de usuarios si es necesario
 * @param {HTMLElement} panel - El panel de usuarios
 */
function preparaUsersPanel(panel) {
    if (!panel) return;
    
    // Verificar si el panel tiene la estructura correcta
    if (!panel.querySelector('h2')) {
        panel.innerHTML = `
            <h2>Gestión de Usuarios</h2>
            <button class="primary-btn admin-only" id="add-user-btn"><i class="fas fa-plus"></i> Nuevo Usuario</button>
            <div class="table-container">
                <table class="settings-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Usuario</th>
                            <th>Correo</th>
                            <th>Nombre Completo</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="7" class="center-text">Cargando usuarios...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
        
        // Configurar el botón de nuevo usuario
        const addUserBtn = panel.querySelector('#add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => usersModule.showUserModal());
        }
    }
}

/**
 * Configura los formularios de configuración
 */
function setupSettingsForms() {
    // Configurar formulario de configuraciones generales
    setupGeneralSettingsForm();
    
    // Configurar formulario de notificaciones
    setupNotificationsSettingsForm();
    
    // Configurar formulario de facturación
    setupBillingSettingsForm();
    
    // Configurar formulario de WhatsApp
    setupWhatsAppSettingsForm();
    
    // Configurar formulario de respaldo
    setupBackupSettingsForm();
    
    // Botones específicos
    document.getElementById('whatsapp-connect-btn')?.addEventListener('click', connectWhatsApp);
    document.getElementById('whatsapp-disconnect-btn')?.addEventListener('click', disconnectWhatsApp);
    document.getElementById('create-backup-btn')?.addEventListener('click', createBackup);
    
    console.log('Formularios de settings configurados');
}

/**
 * Configura el formulario de configuraciones generales
 */
function setupGeneralSettingsForm() {
    const form = document.getElementById('general-settings-form');
    if (!form) return;
    
    // Crear campos del formulario
    form.innerHTML = `
        <div class="form-section">
            <h3>Información de la Empresa</h3>
            <div class="form-group">
                <label for="empresa_nombre">Nombre de la Empresa</label>
                <input type="text" id="empresa_nombre" name="empresa_nombre">
            </div>
            <div class="form-group">
                <label for="empresa_direccion">Dirección</label>
                <input type="text" id="empresa_direccion" name="empresa_direccion">
            </div>
            <div class="form-group">
                <label for="empresa_telefono">Teléfono</label>
                <input type="tel" id="empresa_telefono" name="empresa_telefono">
            </div>
            <div class="form-group">
                <label for="empresa_correo">Correo Electrónico</label>
                <input type="email" id="empresa_correo" name="empresa_correo">
            </div>
        </div>
        
        <div class="form-section">
            <h3>Apariencia</h3>
            <div class="form-group">
                <label for="color_primario">Color Primario</label>
                <input type="color" id="color_primario" name="color_primario">
            </div>
            <div class="form-group">
                <label for="color_secundario">Color Secundario</label>
                <input type="color" id="color_secundario" name="color_secundario">
            </div>
        </div>
        
        <div class="form-section">
            <h3>Configuración General</h3>
            <div class="form-group">
                <label for="moneda_defecto">Moneda por Defecto</label>
                <select id="moneda_defecto" name="moneda_defecto">
                    <option value="PEN">Sol Peruano (PEN)</option>
                    <option value="USD">Dólar Americano (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="dias_alerta_vencimiento">Días para Alertar Vencimiento</label>
                <input type="number" id="dias_alerta_vencimiento" name="dias_alerta_vencimiento" min="1" max="30">
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="primary-btn">Guardar Cambios</button>
            <button type="reset" class="secondary-btn">Cancelar</button>
        </div>
    `;
    
    // Configurar evento de submit
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        await saveSettings(this);
    });
}

/**
 * Configura el formulario de notificaciones
 */
function setupNotificationsSettingsForm() {
    const form = document.getElementById('notifications-settings-form');
    if (!form) return;
    
    // Crear campos del formulario
    form.innerHTML = `
        <div class="form-section">
            <h3>Notificaciones por Correo</h3>
            <div class="form-group">
                <label for="notificacion_correo_activo">Activar Notificaciones por Correo</label>
                <div class="toggle-container">
                    <input type="checkbox" id="notificacion_correo_activo" name="notificacion_correo_activo" class="toggle-input">
                    <label for="notificacion_correo_activo" class="toggle-label"></label>
                </div>
            </div>
            <div class="form-group">
                <label for="correo_recordatorio_dias">Días antes para enviar recordatorio</label>
                <input type="number" id="correo_recordatorio_dias" name="correo_recordatorio_dias" min="1" max="15">
            </div>
        </div>
        
        <div class="form-section">
            <h3>Notificaciones por WhatsApp</h3>
            <div class="form-group">
                <label for="notificacion_whatsapp_activo">Activar Notificaciones por WhatsApp</label>
                <div class="toggle-container">
                    <input type="checkbox" id="notificacion_whatsapp_activo" name="notificacion_whatsapp_activo" class="toggle-input">
                    <label for="notificacion_whatsapp_activo" class="toggle-label"></label>
                </div>
            </div>
            <div class="form-group">
                <label for="plantilla_recordatorio">Plantilla de Recordatorio</label>
                <textarea id="plantilla_recordatorio" name="plantilla_recordatorio" rows="3"></textarea>
                <small>Usa {cliente}, {monto}, {servicio}, {fecha} como variables.</small>
            </div>
            <div class="form-group">
                <label for="plantilla_agradecimiento">Plantilla de Agradecimiento</label>
                <textarea id="plantilla_agradecimiento" name="plantilla_agradecimiento" rows="3"></textarea>
                <small>Usa {cliente}, {monto}, {servicio} como variables.</small>
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="primary-btn">Guardar Cambios</button>
            <button type="reset" class="secondary-btn">Restaurar Valores</button>
        </div>
    `;
    
    // Configurar evento de submit
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        await saveSettings(this);
    });
}

/**
 * Configura el formulario de facturación
 */
function setupBillingSettingsForm() {
    const form = document.getElementById('billing-settings-form');
    if (!form) return;
    
    // Crear campos del formulario
    form.innerHTML = `
        <div class="form-section">
            <h3>Configuración de Facturación</h3>
            <div class="form-group">
                <label for="facturacion_serie">Serie de Factura</label>
                <input type="text" id="facturacion_serie" name="facturacion_serie" placeholder="F001">
            </div>
            <div class="form-group">
                <label for="facturacion_correlativo">Correlativo Inicial</label>
                <input type="number" id="facturacion_correlativo" name="facturacion_correlativo" min="1">
            </div>
            <div class="form-group">
                <label for="facturacion_igv">IGV (%)</label>
                <input type="number" id="facturacion_igv" name="facturacion_igv" min="0" max="100" step="0.01">
            </div>
        </div>
        
        <div class="form-section">
            <h3>Datos del Emisor</h3>
            <div class="form-group">
                <label for="facturacion_ruc">RUC</label>
                <input type="text" id="facturacion_ruc" name="facturacion_ruc">
            </div>
            <div class="form-group">
                <label for="facturacion_razon_social">Razón Social</label>
                <input type="text" id="facturacion_razon_social" name="facturacion_razon_social">
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="primary-btn">Guardar Cambios</button>
            <button type="reset" class="secondary-btn">Cancelar</button>
        </div>
    `;
    
    // Configurar evento de submit
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        await saveSettings(this);
    });
}

/**
 * Configura el formulario de WhatsApp
 */
function setupWhatsAppSettingsForm() {
    const form = document.getElementById('whatsapp-settings-form');
    if (!form) return;
    
    // Crear campos del formulario
    form.innerHTML = `
        <div class="form-section">
            <h3>Configuración de WhatsApp</h3>
            <div class="form-group">
                <label for="whatsapp_mensaje_saludo">Mensaje de Saludo</label>
                <textarea id="whatsapp_mensaje_saludo" name="whatsapp_mensaje_saludo" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label for="whatsapp_nombre_empresa">Nombre de Empresa para WhatsApp</label>
                <input type="text" id="whatsapp_nombre_empresa" name="whatsapp_nombre_empresa">
            </div>
            <div class="form-group">
                <label for="whatsapp_envio_automatico">Activar Envío Automático</label>
                <div class="toggle-container">
                    <input type="checkbox" id="whatsapp_envio_automatico" name="whatsapp_envio_automatico" class="toggle-input">
                    <label for="whatsapp_envio_automatico" class="toggle-label"></label>
                </div>
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="primary-btn">Guardar Cambios</button>
            <button type="reset" class="secondary-btn">Cancelar</button>
        </div>
    `;
    
    // Configurar evento de submit
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        await saveSettings(this);
    });
}

/**
 * Configura el formulario de respaldo
 */
function setupBackupSettingsForm() {
    const form = document.getElementById('backup-settings-form');
    if (!form) return;
    
    // Crear campos del formulario
    form.innerHTML = `
        <div class="form-section">
            <h3>Configuración de Respaldos</h3>
            <div class="form-group">
                <label for="backup_auto">Respaldo Automático</label>
                <div class="toggle-container">
                    <input type="checkbox" id="backup_auto" name="backup_auto" class="toggle-input">
                    <label for="backup_auto" class="toggle-label"></label>
                </div>
            </div>
            <div class="form-group">
                <label for="backup_frecuencia">Frecuencia de Respaldo</label>
                <select id="backup_frecuencia" name="backup_frecuencia">
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                </select>
            </div>
            <div class="form-group">
                <label for="backup_hora">Hora de Respaldo</label>
                <input type="time" id="backup_hora" name="backup_hora">
            </div>
            <div class="form-group">
                <label for="backup_max">Máximo de Respaldos a Mantener</label>
                <input type="number" id="backup_max" name="backup_max" min="1" max="100">
            </div>
        </div>
        
        <div class="form-section">
            <h3>Respaldos Disponibles</h3>
            <div class="backup-list">
                <p>Cargando respaldos...</p>
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="primary-btn">Guardar Configuración</button>
            <button type="reset" class="secondary-btn">Cancelar</button>
        </div>
    `;
    
    // Configurar evento de submit
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        await saveSettings(this);
    });
}

/**
 * Carga las configuraciones desde el servidor
 */
async function loadSettings() {
    console.log("API: Cargando configuraciones...");
    showLoadingOverlay('Cargando configuración...');
    
    try {
        const settings = await apiFetch('/settings');
        console.log("Configuraciones recibidas:", settings);
        
        // Actualizar todos los campos con los valores recibidos
        Object.keys(settings).forEach(key => {
            const input = document.querySelector(`.settings-form [name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = settings[key] === 'true' || settings[key] === true;
                } else if (input.type === 'color') {
                    input.value = settings[key] || '#ffffff';
                } else {
                    input.value = settings[key] || '';
                }
            }
        });
        
        // Marcar como cargado
        document.getElementById('settings').dataset.loaded = 'true';
        console.log("Formularios de settings poblados.");
        
        // Cargar datos específicos
        await loadWhatsAppStatus();
        await loadBackupsList();
        
        return settings;
    } catch (error) { 
        console.error("Error cargando configuraciones:", error); 
        showToast('Error', 'No se pudieron cargar las configuraciones.', 'error');
        throw error;
    } finally { 
        hideLoadingOverlay(); 
    }
}

/**
 * Guarda las configuraciones en el servidor
 * @param {HTMLFormElement} form - Formulario con las configuraciones a guardar
 */
async function saveSettings(form) {
    if (!form) {
        showToast('Error', 'Formulario no encontrado', 'error');
        return;
    }
    
    const formData = new FormData(form);
    const configuraciones = {};
    
    formData.forEach((value, key) => { 
        configuraciones[key] = value;
    });
    
    console.log("Guardando configuraciones:", configuraciones);
    
    try {
        showLoadingOverlay('Guardando configuración...');
        
        const response = await apiFetch('/settings', {
            method: 'PUT',
            body: configuraciones
        });
        
        showToast('Configuración Guardada', 'Configuración guardada correctamente.', 'success');
        return response;
    } catch (error) {
        console.error('Error guardando configuración:', error);
        showToast('Error', error.data?.message || error.message || 'No se pudo guardar la configuración.', 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Carga el estado de WhatsApp
 */
async function loadWhatsAppStatus() {
    console.log("API: Cargando estado de WhatsApp...");
    
    try {
        const data = await apiFetch('/settings/whatsapp/status');
        
        const statusContainer = document.querySelector('.whatsapp-connection-status');
        const statusTitle = document.getElementById('whatsapp-status-title');
        const statusNumber = document.getElementById('whatsapp-status-number');
        const connectBtn = document.getElementById('whatsapp-connect-btn');
        const disconnectBtn = document.getElementById('whatsapp-disconnect-btn');
        
        if (!statusContainer || !statusTitle || !statusNumber || !connectBtn || !disconnectBtn) {
            console.error("Elementos de WhatsApp no encontrados en el DOM");
            return;
        }
        
        // Actualizar interfaz según el estado
        if (data.status === 'connected') {
            statusContainer.classList.add('connected');
            statusContainer.classList.remove('disconnected');
            statusTitle.textContent = 'WhatsApp Conectado';
            statusNumber.textContent = data.number || '+51 987654321';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-flex';
        } else {
            statusContainer.classList.remove('connected');
            statusContainer.classList.add('disconnected');
            statusTitle.textContent = 'WhatsApp Desconectado';
            statusNumber.textContent = 'No conectado';
            connectBtn.style.display = 'inline-flex';
            disconnectBtn.style.display = 'none';
        }
        
        console.log("Estado de WhatsApp actualizado en UI:", data.status);
        return data;
    } catch (error) {
        console.error("Error obteniendo estado de WhatsApp:", error);
        showToast('Error', 'No se pudo obtener el estado de conexión de WhatsApp.', 'error');
        throw error;
    }
}

/**
 * Conecta con WhatsApp
 */
async function connectWhatsApp() {
    console.log("API: Iniciando conexión con WhatsApp...");
    
    try {
        showLoadingOverlay('Conectando con WhatsApp...');
        
        const respuesta = await apiFetch('/settings/whatsapp/connect', { 
            method: 'POST' 
        });
        
        showToast('Conectado', respuesta.message || 'WhatsApp conectado correctamente.', 'success');
        await loadWhatsAppStatus();
        
        return respuesta;
    } catch (error) {
        console.error("Error conectando WhatsApp:", error);
        showToast('Error', error.data?.message || error.message || 'No se pudo conectar con WhatsApp.', 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Desconecta de WhatsApp
 */
async function disconnectWhatsApp() {
    if (!confirm('¿Está seguro de desconectar WhatsApp? Esto cerrará la sesión actual.')) {
        return;
    }
   
    console.log("API: Desconectando WhatsApp...");
    
    try {
        showLoadingOverlay('Desconectando WhatsApp...');
        
        const respuesta = await apiFetch('/settings/whatsapp/disconnect', { 
            method: 'POST' 
        });
        
        showToast('Desconectado', respuesta.message || 'WhatsApp desconectado correctamente.', 'success');
        await loadWhatsAppStatus();
        
        return respuesta;
    } catch (error) {
        console.error("Error desconectando WhatsApp:", error);
        showToast('Error', error.data?.message || error.message || 'No se pudo desconectar de WhatsApp.', 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Carga la lista de respaldos disponibles
 */
async function loadBackupsList() {
    const backupListContainer = document.querySelector('.backup-list');
    if (!backupListContainer) return;
    
    console.log("API: Cargando lista de backups...");
    backupListContainer.innerHTML = '<p>Cargando respaldos...</p>';
     
    try {
        const data = await apiFetch('/settings/backups');
        backupListContainer.innerHTML = '';
         
        if (data.backups && data.backups.length > 0) {
            data.backups.forEach(backup => {
                const fechaFormateada = formatDate(backup.fecha, 'medium');
                const item = document.createElement('div');
                item.className = 'backup-item';
                item.dataset.backupId = backup.id;
                item.innerHTML = `
                    <div class="backup-item-info">
                        <i class="fas fa-file-archive"></i>
                        <div>
                            <h4>Respaldo ${backup.id}</h4>
                            <p>${fechaFormateada} · ${backup.tamanio}</p>
                        </div>
                    </div>
                    <div class="backup-item-actions">
                        <button class="icon-action download-backup-btn" title="Descargar"><i class="fas fa-download"></i></button>
                        <button class="icon-action restore-backup-btn" title="Restaurar"><i class="fas fa-undo"></i></button>
                        <button class="icon-action delete-btn delete-backup-btn" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                backupListContainer.appendChild(item);
                
                // Configurar listeners
                item.querySelector('.download-backup-btn').addEventListener('click', () => downloadBackup(backup.id));
                item.querySelector('.restore-backup-btn').addEventListener('click', () => restoreBackup(backup.id));
                item.querySelector('.delete-backup-btn').addEventListener('click', () => deleteBackup(backup.id));
            });
        } else {
            backupListContainer.innerHTML = '<p>No hay respaldos disponibles.</p>';
        }
        
        return data.backups;
    } catch (error) {
        console.error("Error cargando lista de backups:", error);
        backupListContainer.innerHTML = '<p class="error-message">Error al cargar respaldos.</p>';
        throw error;
    }
}

/**
 * Crea un nuevo respaldo
 */
async function createBackup() {
    console.log("API: Creando nuevo backup...");
    
    try {
        showLoadingOverlay('Creando respaldo de datos...');
        
        const respuesta = await apiFetch('/settings/backup/create', { 
            method: 'POST' 
        });
        
        showToast('Respaldo Creado', respuesta.message || 'Respaldo creado correctamente.', 'success');
        await loadBackupsList();
        
        return respuesta;
    } catch (error) {
        console.error("Error creando backup:", error);
        showToast('Error', error.data?.message || error.message || 'No se pudo crear el respaldo.', 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Descarga un respaldo
 * @param {string} backupId - ID del respaldo a descargar
 */
async function downloadBackup(backupId) {
    console.log(`API: Descargando backup ${backupId}...`);
    
    try {
        showLoadingOverlay('Preparando descarga...');
        
        const response = await apiFetch(`/settings/backups/${backupId}/download`);
        
        // Crear blob y descargar
        const blob = new Blob([response.data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_pegasus_${backupId}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Descargado', 'Archivo de respaldo descargado correctamente.', 'success');
    } catch (error) {
        console.error(`Error descargando backup ${backupId}:`, error);
        showToast('Error', error.data?.message || error.message || 'No se pudo descargar el respaldo.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Restaura un respaldo
 * @param {string} backupId - ID del respaldo a restaurar
 */
async function restoreBackup(backupId) {
    if (!confirm(`¿Restaurar el respaldo ${backupId}? Esto podría sobrescribir datos actuales.`)) {
        return;
    }
    
    console.log(`API: Restaurando backup ${backupId}...`);
    
    try {
        showLoadingOverlay('Restaurando respaldo...');
        
        const respuesta = await apiFetch(`/settings/backups/${backupId}/restore`, {
            method: 'POST'
        });
        
        showToast('Restaurado', respuesta.message || 'Respaldo restaurado correctamente.', 'success');
        
        // Recargar la página para aplicar cambios
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
        return respuesta;
    } catch (error) {
        console.error(`Error restaurando backup ${backupId}:`, error);
        showToast('Error', error.data?.message || error.message || 'No se pudo restaurar el respaldo.', 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Elimina un respaldo
 * @param {string} backupId - ID del respaldo a eliminar
 */
async function deleteBackup(backupId) {
    if (!confirm(`¿Eliminar el respaldo ${backupId}?`)) {
        return;
    }
    
    console.log(`API: Eliminando backup ${backupId}...`);
    
    try {
        showLoadingOverlay('Eliminando respaldo...');
        
        const respuesta = await apiFetch(`/settings/backups/${backupId}`, {
            method: 'DELETE'
        });
        
        showToast('Eliminado', respuesta.message || 'Respaldo eliminado correctamente.', 'success');
        
        // Eliminar elemento de la lista
        const backupItem = document.querySelector(`.backup-item[data-backup-id="${backupId}"]`);
        if (backupItem) {
            backupItem.remove();
        }
        
        // Si no quedan respaldos, mostrar mensaje
        const backupItems = document.querySelectorAll('.backup-item');
        if (backupItems.length === 0) {
            document.querySelector('.backup-list').innerHTML = '<p>No hay respaldos disponibles.</p>';
        }
        
        return respuesta;
    } catch (error) {
        console.error(`Error eliminando backup ${backupId}:`, error);
        showToast('Error', error.data?.message || error.message || 'No se pudo eliminar el respaldo.', 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

export {
    initSettings,
    loadSettings,
    saveSettings,
    loadWhatsAppStatus,
    connectWhatsApp,
    disconnectWhatsApp,
    loadBackupsList,
    createBackup,
    downloadBackup,
    restoreBackup,
    deleteBackup,
    showSettingsPanel
};