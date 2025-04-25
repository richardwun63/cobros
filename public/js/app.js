/**
 * app.js
 * Archivo principal de la aplicación PEGASUS - Sistema de Cobranzas
 * Contiene la configuración e inicialización principal
 */

import { showToast, hideToast } from './utils/toast.js';
import { showModal, hideModal, closeAllModals } from './utils/modal.js';
import { showLoadingOverlay, hideLoadingOverlay } from './utils/loading.js';
import { apiFetch, handleApiError } from './utils/api.js';

// Importar módulos funcionales
import * as authModule from './modules/auth.js';
import * as dashboardModule from './modules/dashboard.js';
import * as clientsModule from './modules/clients.js';
import * as paymentsModule from './modules/payments.js';
import * as servicesModule from './modules/services.js';
import * as reportsModule from './modules/reports.js';
import * as settingsModule from './modules/settings.js';
import * as usersModule from './modules/users.js';
import * as whatsappModule from './modules/whatsapp.js';

// Variables globales
let currentUserRole = null;

/**
 * Inicializa la aplicación principal
 */
async function initApp() {
    console.log('Inicializando aplicación PEGASUS...');
    
    // Verificar si existe una sesión activa
    const authToken = sessionStorage.getItem('authToken');
    const loggedInUsername = sessionStorage.getItem('loggedInUsername');
    const loggedInRole = sessionStorage.getItem('loggedInRole');

    if (authToken && loggedInUsername && loggedInRole) {
        console.log('Sesión encontrada en sessionStorage. Inicializando app...');
        currentUserRole = loggedInRole;
        displayApp();
        setupApplication();
    } else {
        console.log('No hay sesión guardada. Mostrando login...');
        sessionStorage.clear();
        displayLogin();
        authModule.setupLogin();
    }
}

/**
 * Configura la aplicación una vez autenticada
 */
async function setupApplication() {
    console.log('Configurando aplicación para rol:', currentUserRole);
    
    // Actualizar información del usuario
    updateUserInfoDisplay();
    
    // Aplicar restricciones según el rol
    applyRoleRestrictions(currentUserRole);
    
    // Configurar fecha actual
    setCurrentDate();
    
    // Configurar navegación y elementos de UI
    setupNavigation();
    setupFilters();
    setupGeneralButtonListeners();
    
    // Inicializar módulos
    authModule.initAuth();
    dashboardModule.initDashboard();
    clientsModule.initClients();
    paymentsModule.initPayments();
    servicesModule.initServices();
    reportsModule.initReports();
    settingsModule.initSettings();
    
    // Cargar datos iniciales
    console.log('Cargando datos iniciales...');
    await loadInitialData();
    
    // Mostrar mensaje de bienvenida
    const username = sessionStorage.getItem('loggedInUsername');
    showToast(`¡Bienvenido ${username}!`, 'Sesión iniciada correctamente', 'success');
}

/**
 * Carga los datos iniciales para la aplicación
 */
async function loadInitialData() {
    console.log('Cargando datos iniciales desde el backend...');
    showLoadingOverlay();
    
    try {
        const promises = [
            dashboardModule.loadDashboardData().catch(error => {
                console.error("Error cargando datos del dashboard:", error);
                return null;
            }),
            clientsModule.loadClients().catch(error => {
                console.error("Error cargando clientes:", error);
                return null;
            }),
            paymentsModule.loadPayments().catch(error => {
                console.error("Error cargando cobros:", error);
                return null;
            }),
            servicesModule.loadServicesForSelects().catch(error => {
                console.error("Error cargando servicios para selects:", error);
                return null;
            }),
            clientsModule.loadClientsForSelects().catch(error => {
                console.error("Error cargando clientes para selects:", error);
                return null;
            }),
            servicesModule.loadServices().catch(error => {
                console.error("Error cargando servicios:", error);
                return null;
            })
        ];

        await Promise.allSettled(promises);
        
        console.log('Carga inicial de datos completada.');
    } catch (error) { 
        console.error("Error general cargando datos iniciales:", error);
        showToast('Error Carga Inicial', `No se pudieron cargar algunos datos: ${error.message}`, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Actualiza la información del usuario en la interfaz
 */
function updateUserInfoDisplay() {
    const userNameElement = document.getElementById('logged-in-user-name');
    const userRoleElement = document.getElementById('logged-in-user-role');
    const userAvatarElement = document.querySelector('.user-avatar');
    
    const loggedInUsername = sessionStorage.getItem('loggedInUsername');
    const loggedInRole = sessionStorage.getItem('loggedInRole');

    if (userNameElement && loggedInUsername) {
        userNameElement.textContent = loggedInUsername;
    }
    
    if (userRoleElement && loggedInRole) {
        userRoleElement.textContent = loggedInRole;
    }
    
    if (userAvatarElement && loggedInUsername) {
        userAvatarElement.textContent = loggedInUsername.charAt(0).toUpperCase();
    }
    
    console.log(`Info de usuario mostrada: ${loggedInUsername} (${loggedInRole})`);
}

/**
 * Aplica restricciones de interfaz según el rol del usuario
 * @param {string} role - Rol del usuario
 */
function applyRoleRestrictions(role) {
    console.log(`Aplicando restricciones visuales para el rol: ${role}`);
    
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    document.body.classList.remove('user-role-admin', 'user-role-user');

    if (role === 'Administrador') {
        document.body.classList.add('user-role-admin');
        adminOnlyElements.forEach(el => { 
            el.style.display = el.tagName.toLowerCase() === 'li' ? 'flex' : 'block'; 
        });
        console.log('Elementos admin-only habilitados.');
    } else {
        document.body.classList.add('user-role-user');
        adminOnlyElements.forEach(el => { el.style.display = 'none'; });
        console.log('Elementos admin-only ocultados.');
        
        const activeAdminSetting = document.querySelector('.settings-menu li.admin-only.active');
        const activeAdminPanel = document.querySelector('.settings-panel.admin-only.active');
        
        if (activeAdminSetting || activeAdminPanel) {
            console.log('Panel/Tab de settings admin estaba activo, cambiando a General...');
            document.querySelectorAll('.settings-menu li.active, .settings-panel.active')
                .forEach(el => el.classList.remove('active'));
                
            document.querySelector('.settings-menu li[data-settings="general"]')?.classList.add('active');
            document.getElementById('general-settings')?.classList.add('active');
        }
        
        if (document.querySelector('#usuarios.page.active')) {
            document.querySelector('.nav-menu li[data-page="dashboard"]')?.click();
        }
    }
    
    console.log(`Clase del body ajustada. Rol: ${role}`);
}

/**
 * Configura la fecha actual en el dashboard
 */
function setCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        let formattedDate = today.toLocaleDateString('es-ES', options);
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1).replace(/ de (\w)/, (match, p1) => ` de ${p1.toUpperCase()}`);
        dateElement.textContent = formattedDate;
    }
}

/**
 * Configura la navegación entre secciones
 */
function setupNavigation() {
    const menuItems = document.querySelectorAll('.nav-menu ul li[data-page]');
    menuItems.forEach(item => {
         if (item.dataset.listenerAttached === 'true') return; 
         item.dataset.listenerAttached = 'true';
        item.addEventListener('click', function() {
            if (this.classList.contains('admin-only') && currentUserRole !== 'Administrador') {
                showToast('Acceso Denegado', 'No tienes permisos para esta sección.', 'warning'); 
                return;
            }
            menuItems.forEach(i => i.classList.remove('active')); 
            this.classList.add('active');
            showPage(this.getAttribute('data-page'));
        });
    });
    
    const settingsMenuItems = document.querySelectorAll('.settings-menu li[data-settings]');
    settingsMenuItems.forEach(item => {
         if (item.dataset.listenerAttached === 'true') return; 
         item.dataset.listenerAttached = 'true';
        item.addEventListener('click', function() {
             if (this.classList.contains('admin-only') && currentUserRole !== 'Administrador') {
                showToast('Acceso Denegado', 'No tienes permisos para esta sección.', 'warning'); 
                return;
             }
            settingsMenuItems.forEach(i => i.classList.remove('active')); 
            this.classList.add('active');
            showSettingsPanel(this.getAttribute('data-settings'));
        });
    });
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && !logoutBtn.dataset.listenerAttached) {
         logoutBtn.addEventListener('click', authModule.handleLogout); 
         logoutBtn.dataset.listenerAttached = 'true';
    }
    
    document.querySelectorAll('[data-page-target]').forEach(button => {
        if (button.dataset.listenerAttached === 'true') return; 
        button.dataset.listenerAttached = 'true';
        button.addEventListener('click', function(e) {
            e.preventDefault(); 
            const targetPageId = this.getAttribute('data-page-target');
            const targetMenuItem = document.querySelector(`.nav-menu li[data-page='${targetPageId}']`);
            if (targetMenuItem) { 
                targetMenuItem.click(); 
            } else { 
                console.warn(`No se encontró item de menú para data-page-target: ${targetPageId}`); 
            }
        });
    });
    
    console.log('Listeners de navegación configurados.');
}

/**
 * Configura los listeners y filtros de la interfaz
 */
function setupFilters() {
    console.log("Configurando filtros para llamadas API...");
    
    clientsModule.setupClientFilters();
    paymentsModule.setupPaymentFilters();
    servicesModule.setupServiceFilters();
    reportsModule.setupReportFilters();
    
    console.log('Listeners de filtros configurados.');
}

/**
 * Configura listeners para botones generales
 */
function setupGeneralButtonListeners() {
    console.log("Configurando listeners de botones generales...");
    
    // Botón de notificaciones
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn && !notificationsBtn.dataset.listenerAttached) {
        notificationsBtn.addEventListener('click', dashboardModule.showNotificationsDropdown);
        notificationsBtn.dataset.listenerAttached = 'true';
    }
    
    // Botones de impresión y exportación
    const printReportBtn = document.getElementById('print-report-btn');
    if (printReportBtn && !printReportBtn.dataset.listenerAttached) {
        printReportBtn.addEventListener('click', () => window.print());
        printReportBtn.dataset.listenerAttached = 'true';
    }
    
    const exportReportBtn = document.getElementById('export-report-btn');
    if (exportReportBtn && !exportReportBtn.dataset.listenerAttached) {
        exportReportBtn.addEventListener('click', reportsModule.exportReport);
        exportReportBtn.dataset.listenerAttached = 'true';
    }
    
    console.log('Listeners de botones generales configurados.');
}

/**
 * Muestra una página específica
 * @param {string} pageId - ID de la página a mostrar
 */
function showPage(pageId) {
    console.log(`Mostrando página: ${pageId}`);
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) { 
        selectedPage.classList.add('active'); 
        document.querySelector('.main-content')?.scrollTo(0, 0); 
    } else { 
        console.warn(`Página con ID "${pageId}" no encontrada.`); 
    }
}

/**
 * Muestra un panel de configuración
 * @param {string} settingsId - ID del panel de configuración
 */
function showSettingsPanel(settingsId) {
    console.log(`Mostrando panel de settings: ${settingsId}`);
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
    const selectedPanel = document.getElementById(`${settingsId}-settings`);
    if (selectedPanel) { 
        selectedPanel.classList.add('active'); 
    } else {
        console.warn(`Panel de configuración con ID "${settingsId}-settings" no encontrado.`);
        document.getElementById('general-settings')?.classList.add('active');
        document.querySelector('.settings-menu li[data-settings="general"]')?.classList.add('active');
    }
}

/**
 * Muestra la pantalla de login
 */
function displayLogin() {
   const loginPage = document.getElementById('login-page');
   const appContainer = document.querySelector('.app-container');
   if (loginPage) loginPage.style.display = 'flex';
   if (appContainer) appContainer.style.display = 'none';
}

/**
 * Muestra la aplicación principal
 */
function displayApp() {
   const loginPage = document.getElementById('login-page');
   const appContainer = document.querySelector('.app-container');
   if (loginPage) loginPage.style.display = 'none';
   if (appContainer) appContainer.style.display = 'flex';
}

// Exportar funciones públicas
export { 
    initApp, 
    displayLogin, 
    displayApp, 
    showPage, 
    showSettingsPanel,
    updateUserInfoDisplay,
    applyRoleRestrictions, 
    currentUserRole
};