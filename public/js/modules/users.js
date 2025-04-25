/**
 * users.js
 * Módulo para gestionar usuarios en el sistema
 */

import { apiFetch, handleApiError } from '../utils/api.js';
import { showToast } from '../utils/toast.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../utils/loading.js';
import { createModal, closeAllModals } from '../utils/modal.js';
import { formatDate } from '../utils/formatting.js';

/**
 * Inicializa el módulo de usuarios
 */
function initUsers() {
    console.log('Inicializando módulo de Usuarios...');
    
    // Configurar botones de agregar usuario
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => showUserModal());
    }
}

/**
 * Carga los usuarios para la tabla de administración
 */
async function loadUsers() {
    // Verificar si la tabla existe antes de intentar manipularla
    const usersSettingsPanel = document.getElementById('users-settings');
    if (!usersSettingsPanel) {
        console.error('El panel de usuarios no existe en el DOM');
        return;
    }
    
    // Crear la tabla si no existe
    let usersTable = usersSettingsPanel.querySelector('.settings-table');
    if (!usersTable) {
        console.log('Creando tabla de usuarios...');
        const tableContainer = usersSettingsPanel.querySelector('.table-container');
        
        // Si no existe el contenedor de tabla, crearlo
        if (!tableContainer) {
            const newTableContainer = document.createElement('div');
            newTableContainer.className = 'table-container';
            
            // Insertar después del botón de añadir usuario o al final del panel
            const addUserBtn = usersSettingsPanel.querySelector('#add-user-btn');
            if (addUserBtn) {
                addUserBtn.parentNode.insertBefore(newTableContainer, addUserBtn.nextSibling);
            } else {
                usersSettingsPanel.appendChild(newTableContainer);
            }
            
            newTableContainer.innerHTML = `
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
            `;
            
            usersTable = newTableContainer.querySelector('.settings-table');
        } else {
            tableContainer.innerHTML = `
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
            `;
            
            usersTable = tableContainer.querySelector('.settings-table');
        }
    }
    
    const usuariosTableBody = usersTable.querySelector('tbody');
    if (!usuariosTableBody) {
        console.error('No se encontró el tbody en la tabla de usuarios');
        return;
    }

    console.log("API: Cargando usuarios...");
    usuariosTableBody.innerHTML = '<tr><td colspan="7" class="center-text">Cargando usuarios...</td></tr>';
    
    try {
        // Mostrar log para depuración
        console.log("Intentando fetch a /usuarios");
        const usuarios = await apiFetch('/usuarios', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        console.log("Respuesta de usuarios recibida:", usuarios);
        
        if (!usuarios || usuarios.length === 0) {
            usuariosTableBody.innerHTML = '<tr><td colspan="7" class="center-text">No hay usuarios registrados.</td></tr>';
            return;
        }
        
        usuariosTableBody.innerHTML = ''; // Limpiar antes de añadir filas
        
        usuarios.forEach(usuario => {
            const activo = usuario.activo ? '<span class="status-badge active">Activo</span>' : '<span class="status-badge inactive">Inactivo</span>';
            
            const fila = document.createElement('tr');
            fila.dataset.userId = usuario.id;
            fila.innerHTML = `
                <td>${usuario.id}</td>
                <td>${usuario.nombre_usuario}</td>
                <td>${usuario.correo_electronico}</td>
                <td>${usuario.nombre_completo || '-'}</td>
                <td>${usuario.rol?.nombre_rol || 'Sin rol'}</td>
                <td>${activo}</td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-action edit-btn" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="icon-action change-password-btn" title="Cambiar contraseña"><i class="fas fa-key"></i></button>
                        <button class="icon-action toggle-status-btn" title="${usuario.activo ? 'Desactivar' : 'Activar'}">
                            <i class="fas fa-${usuario.activo ? 'toggle-off' : 'toggle-on'}"></i>
                        </button>
                        <button class="icon-action delete-btn" title="Eliminar" ${usuario.rol?.nombre_rol === 'Administrador' ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            usuariosTableBody.appendChild(fila);
            
            // Configurar listeners para los botones de acción
            fila.querySelector('.edit-btn').addEventListener('click', () => showUserModal(usuario.id));
            fila.querySelector('.change-password-btn').addEventListener('click', () => showChangePasswordModal(usuario.id));
            fila.querySelector('.toggle-status-btn').addEventListener('click', () => toggleUserStatus(usuario.id, !usuario.activo));
            
            const deleteBtn = fila.querySelector('.delete-btn');
            if (!deleteBtn.disabled) {
                deleteBtn.addEventListener('click', () => deleteUser(usuario.id));
            }
        });
        
        console.log(`Tabla de usuarios generada con ${usuarios.length} filas.`);
    } catch (error) {
        console.error("Error cargando usuarios:", error);
        usuariosTableBody.innerHTML = `<tr><td colspan="7" class="center-text error-message">Error al cargar usuarios: ${error.message || 'Error desconocido'}</td></tr>`;
    }
}

/**
 * Muestra el modal para crear o editar un usuario
 * @param {number} usuarioId - ID del usuario a editar (null para nuevo usuario)
 */
function showUserModal(usuarioId = null) {
    console.log(`Preparando modal usuario. ID: ${usuarioId}`);
    
    // Título según sea nuevo usuario o edición
    const title = usuarioId ? 'Editar Usuario' : 'Agregar Nuevo Usuario';
    
    // Contenido del formulario
    const formHtml = `
        <form id="user-form">
            <div class="form-group">
                <label for="nombre_usuario">Nombre de Usuario <span class="required">*</span></label>
                <input type="text" id="nombre_usuario" name="nombre_usuario" required>
            </div>
            <div class="form-group">
                <label for="correo_electronico">Correo Electrónico <span class="required">*</span></label>
                <input type="email" id="correo_electronico" name="correo_electronico" required>
            </div>
            <div class="form-group">
                <label for="nombre_completo">Nombre Completo</label>
                <input type="text" id="nombre_completo" name="nombre_completo">
            </div>
            <div class="form-group">
                <label for="rol_id">Rol <span class="required">*</span></label>
                <select id="rol_id" name="rol_id" required>
                    <option value="">-- Seleccione Rol --</option>
                    <option value="1">Administrador</option>
                    <option value="2">Usuario</option>
                </select>
            </div>
            ${!usuarioId ? `
            <div class="form-group">
                <label for="contrasena_hash">Contraseña <span class="required">*</span></label>
                <input type="password" id="contrasena_hash" name="contrasena_hash" required>
            </div>
            ` : ''}
            <div class="form-group">
                <label for="activo">Estado</label>
                <select id="activo" name="activo">
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                </select>
            </div>
        </form>
    `;
    
    // Opciones del modal
    const modalOptions = {
        size: 'normal',
        buttons: [
            { id: 'cancel-user', text: 'Cancelar', type: 'secondary', action: 'close' },
            { id: 'save-user', text: usuarioId ? 'Actualizar Usuario' : 'Guardar Usuario', type: 'primary', action: () => saveUser(usuarioId) }
        ]
    };
    
    // Crear el modal
    const modal = createModal('user-modal', title, formHtml, modalOptions);
    
    // Si es edición, cargar datos del usuario
    if (usuarioId) {
        showLoadingOverlay('Cargando datos del usuario...');
        
        apiFetch(`/usuarios/${usuarioId}`)
            .then(usuario => {
                document.getElementById('nombre_usuario').value = usuario.nombre_usuario || '';
                document.getElementById('correo_electronico').value = usuario.correo_electronico || '';
                document.getElementById('nombre_completo').value = usuario.nombre_completo || '';
                document.getElementById('rol_id').value = usuario.rol_id || '';
                document.getElementById('activo').value = usuario.activo ? 'true' : 'false';
                
                hideLoadingOverlay();
            })
            .catch(error => {
                hideLoadingOverlay();
                showToast('Error', `No se pudo cargar datos: ${error.message}`, 'error');
                closeAllModals();
            });
    }
    
    // Mostrar el modal
    modal.style.display = 'flex';
}

/**
 * Guarda los datos de un usuario (nuevo o editado)
 * @param {number} usuarioId - ID del usuario (null para usuario nuevo)
 */
async function saveUser(usuarioId) {
    const form = document.getElementById('user-form');
    if (!form) {
        showToast('Error', 'Formulario no encontrado', 'error');
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const datosUsuario = {};
    
    formData.forEach((value, key) => {
        if (key === 'activo') {
            datosUsuario[key] = value === 'true';
        } else {
            datosUsuario[key] = value;
        }
    });
    
    try {
        showLoadingOverlay(usuarioId ? 'Actualizando usuario...' : 'Guardando usuario...');
        
        let usuarioResultado;
        
        if (usuarioId) {
            // Actualizar usuario existente
            usuarioResultado = await apiFetch(`/usuarios/${usuarioId}`, {
                method: 'PUT',
                body: datosUsuario
            });
            showToast('Éxito', `Usuario "${usuarioResultado.nombre_usuario}" actualizado correctamente.`, 'success');
        } else {
            // Crear nuevo usuario
            usuarioResultado = await apiFetch('/usuarios', {
                method: 'POST',
                body: datosUsuario
            });
            showToast('Éxito', `Usuario "${usuarioResultado.nombre_usuario}" creado correctamente.`, 'success');
        }
        
        // Cerrar modal y recargar datos
        closeAllModals();
        loadUsers();
        
    } catch (error) {
        console.error('Error guardando usuario:', error);
        showToast('Error', error.data?.message || error.message || 'No se pudo guardar el usuario.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Muestra el modal para cambiar la contraseña de un usuario
 * @param {number} usuarioId - ID del usuario
 */
function showChangePasswordModal(usuarioId) {
    console.log(`Abriendo modal cambio contraseña para usuario ID: ${usuarioId}`);
    
    // Contenido del formulario
    const formHtml = `
        <form id="change-password-form">
            <input type="hidden" id="user-id-password" name="userId" value="${usuarioId}">
            <div class="form-group">
                <label for="nueva_contrasena">Nueva Contraseña <span class="required">*</span></label>
                <input type="password" id="nueva_contrasena" name="nueva_contrasena" required minlength="6">
                <small>Mínimo 6 caracteres.</small>
            </div>
            <div class="form-group">
                <label for="confirmar_contrasena">Confirmar Contraseña <span class="required">*</span></label>
                <input type="password" id="confirmar_contrasena" name="confirmar_contrasena" required minlength="6">
            </div>
        </form>
    `;
    
    // Opciones del modal
    const modalOptions = {
        size: 'small',
        buttons: [
            { id: 'cancel-password', text: 'Cancelar', type: 'secondary', action: 'close' },
            { id: 'save-password', text: 'Cambiar Contraseña', type: 'primary', action: () => changePassword(usuarioId) }
        ]
    };
    
    // Crear y mostrar el modal
    const modal = createModal('change-password-modal', 'Cambiar Contraseña', formHtml, modalOptions);
    modal.style.display = 'flex';
}

/**
 * Cambia la contraseña de un usuario
 * @param {number} usuarioId - ID del usuario
 */
async function changePassword(usuarioId) {
    const form = document.getElementById('change-password-form');
    if (!form) {
        showToast('Error', 'Formulario no encontrado', 'error');
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const newPassword = document.getElementById('nueva_contrasena').value;
    const confirmPassword = document.getElementById('confirmar_contrasena').value;
    
    if (newPassword !== confirmPassword) {
        showToast('Error', 'Las contraseñas no coinciden.', 'error');
        return;
    }
    
    try {
        showLoadingOverlay('Cambiando contraseña...');
        
        const response = await apiFetch(`/usuarios/${usuarioId}/contrasena`, {
            method: 'PATCH',
            body: { nuevaContrasena: newPassword }
        });
        
        showToast('Éxito', 'Contraseña cambiada correctamente.', 'success');
        closeAllModals();
        
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        showToast('Error', error.data?.message || error.message || 'Error al cambiar contraseña.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Cambia el estado de un usuario (activo/inactivo)
 * @param {number} usuarioId - ID del usuario
 * @param {boolean} nuevoEstado - Nuevo estado del usuario
 */
async function toggleUserStatus(usuarioId, nuevoEstado) {
    if (!confirm(`¿${nuevoEstado ? 'Activar' : 'Desactivar'} este usuario?`)) {
        return;
    }
    
    console.log(`API: Cambiando estado de usuario ${usuarioId} a ${nuevoEstado ? 'activo' : 'inactivo'}...`);
    
    try {
        showLoadingOverlay('Cambiando estado...');
        
        const response = await apiFetch(`/usuarios/${usuarioId}/estado`, {
            method: 'PATCH',
            body: { activo: nuevoEstado }
        });
        
        showToast('Estado Cambiado', `Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.`, 'success');
        loadUsers();
        
    } catch (error) {
        console.error(`Error cambiando estado de usuario ${usuarioId}:`, error);
        showToast('Error', error.data?.message || error.message || 'No se pudo cambiar el estado.', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Elimina un usuario
 * @param {number} usuarioId - ID del usuario a eliminar
 */
async function deleteUser(usuarioId) {
    if (!confirm('¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        showLoadingOverlay('Eliminando usuario...');
        
        const response = await apiFetch(`/usuarios/${usuarioId}`, {
            method: 'DELETE'
        });
        
        showToast('Usuario Eliminado', 'Usuario eliminado correctamente.', 'success');
        loadUsers();
        
    } catch (error) {
        console.error(`Error eliminando usuario ${usuarioId}:`, error);
        
        let mensaje = 'No se pudo eliminar el usuario.';
        if (error.status === 409) {
            mensaje = 'No se puede eliminar el usuario porque tiene acciones asociadas en el sistema.';
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
    initUsers,
    loadUsers,
    showUserModal,
    showChangePasswordModal,
    changePassword,
    toggleUserStatus,
    deleteUser
};