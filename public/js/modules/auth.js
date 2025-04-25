/**
 * auth.js
 * Módulo para gestionar la autenticación de usuarios
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { displayApp, displayLogin } from '../app.js';

// Variable para almacenar el token actual
let authToken = null;

/**
 * Inicializa el módulo de autenticación
 */
function initAuth() {
    // Recuperar token almacenado en sesión
    authToken = sessionStorage.getItem('authToken');
    
    // Configurar evento de cierre de sesión
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    console.log('Módulo de autenticación inicializado');
}

/**
 * Configura el formulario de login
 */
function setupLogin() {
    const loginForm = document.getElementById('login-form');
    const errorMessageElement = document.getElementById('login-error-message');
    
    if (!loginForm || !errorMessageElement) { 
        console.error("Elementos de login no encontrados."); 
        return; 
    }

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rolSelected = document.querySelector('input[name="login-role"]:checked')?.value || 'admin';
        const submitButton = loginForm.querySelector('button[type="submit"]');
        
        errorMessageElement.style.display = 'none';
        
        if (!username || !password) { 
            errorMessageElement.textContent = 'Por favor, ingresa usuario y contraseña.';
            errorMessageElement.style.display = 'block';
            return; 
        }
        
        submitButton.disabled = true; 
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
        
        try {
            const data = await apiFetch('/auth/login', { 
                method: 'POST', 
                body: { username, password } 
            });
            
            console.log('Login exitoso:', data);
            
            authToken = data.token;
            const userRole = data.usuario.rol;
            
            // Guardar datos de sesión
            sessionStorage.setItem('authToken', authToken);
            sessionStorage.setItem('loggedInUsername', data.usuario.username);
            sessionStorage.setItem('loggedInRole', userRole);
            
            // Si el rol seleccionado en el formulario no coincide con el rol del usuario
            if ((rolSelected === 'admin' && userRole !== 'Administrador') || 
                (rolSelected === 'user' && userRole === 'Administrador')) {
                errorMessageElement.textContent = `Has iniciado sesión como ${userRole}, pero seleccionaste ${rolSelected === 'admin' ? 'Administrador' : 'Usuario'}`;
                errorMessageElement.style.display = 'block';
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            displayApp(); 
            // Recargar la página para inicializar correctamente todos los módulos
            window.location.reload();
        } catch (error) {
            console.error('Error durante el login:', error);
            errorMessageElement.textContent = error.data?.message || error.message || 'Error al iniciar sesión. Verifica tus credenciales.'; 
            errorMessageElement.style.display = 'block';
            document.getElementById('password').value = ''; 
            authToken = null; 
            sessionStorage.clear();
        } finally {
            submitButton.disabled = false; 
            submitButton.innerHTML = 'Ingresar';
        }
    });
    
    console.log('Listener de formulario de login configurado.');
}

/**
 * Maneja el proceso de cierre de sesión
 * @param {boolean} force - Si es true, cierra la sesión sin confirmación
 */
function handleLogout(force = false) {
    if (force || confirm('¿Estás seguro de que deseas cerrar sesión? Los cambios no guardados se perderán.')) {
        console.log('Cerrando sesión...');
        authToken = null;
        sessionStorage.clear();
        displayLogin();
        
        const passwordInput = document.getElementById('password');
        if (passwordInput) passwordInput.value = '';
        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.value = '';
        
        document.body.className = '';
        showToast('Sesión Cerrada', 'Has cerrado sesión exitosamente.', 'info');
    }
}

/**
 * Verifica si hay una sesión activa
 * @returns {boolean} - true si hay una sesión activa
 */
function isAuthenticated() {
    const token = sessionStorage.getItem('authToken');
    return !!token;
}

/**
 * Verifica el token con el servidor
 * @returns {Promise<Object>} - Información del usuario autenticado
 */
async function verifyToken() {
    try {
        const response = await apiFetch('/auth/verificar');
        return response.usuario;
    } catch (error) {
        console.error('Error al verificar token:', error);
        throw error;
    }
}

export { 
    initAuth, 
    setupLogin, 
    handleLogout, 
    isAuthenticated, 
    verifyToken, 
    authToken 
};