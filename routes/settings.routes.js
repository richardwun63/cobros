// routes/settings.routes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { verificarRol } = require('../middleware/role.middleware');

console.log(' R Definiendo rutas de Settings...');

// Aplicar middleware de verificación de token a todas las rutas
router.use(verificarToken);
console.log(' R Middleware verificarToken aplicado a todas las rutas de settings.');

// --- Rutas para Configuraciones Generales ---
// GET /api/settings - Obtener todas las configuraciones
router.get('/', settingsController.obtenerConfiguraciones);

// PUT /api/settings - Actualizar configuraciones
router.put('/', verificarRol('Administrador'), settingsController.actualizarConfiguraciones);

// --- Rutas para WhatsApp ---
// GET /api/settings/whatsapp/status - Obtener estado de WhatsApp
router.get('/whatsapp/status', settingsController.obtenerEstadoWhatsApp);

// POST /api/settings/whatsapp/connect - Iniciar conexión con WhatsApp
router.post('/whatsapp/connect', verificarRol('Administrador'), settingsController.conectarWhatsAppAPI);

// POST /api/settings/whatsapp/disconnect - Cerrar conexión con WhatsApp
router.post('/whatsapp/disconnect', verificarRol('Administrador'), settingsController.desconectarWhatsApp);

// POST /api/settings/whatsapp/notify - Enviar notificación por WhatsApp
router.post('/whatsapp/notify', settingsController.enviarNotificacion);

// --- Rutas para Respaldos ---
// POST /api/settings/backup/create - Crear un nuevo respaldo
router.post('/backup/create', verificarRol('Administrador'), settingsController.crearBackup);

// GET /api/settings/backups - Listar respaldos disponibles
router.get('/backups', verificarRol('Administrador'), settingsController.listarBackups);

// POST /api/settings/backups/:id/restore - Restaurar desde un respaldo
router.post('/backups/:id/restore', verificarRol('Administrador'), settingsController.restaurarBackup);

// DELETE /api/settings/backups/:id - Eliminar un respaldo
router.delete('/backups/:id', verificarRol('Administrador'), settingsController.eliminarBackup);

// --- Rutas para Notificaciones ---
// GET /api/settings/notificaciones - Obtener notificaciones
router.get('/notificaciones', settingsController.obtenerNotificaciones);

// POST /api/settings/notificaciones/:id/marcar-leida - Marcar notificación como leída
router.post('/notificaciones/:id/marcar-leida', settingsController.marcarLeida);

// POST /api/settings/notificaciones/marcar-todas-leidas - Marcar todas las notificaciones como leídas
router.post('/notificaciones/marcar-todas-leidas', settingsController.marcarTodasLeidas);

console.log(' R Rutas de Settings definidas.');
module.exports = router;