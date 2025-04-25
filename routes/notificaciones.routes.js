// routes/notificaciones.routes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { verificarToken } = require('../middleware/auth.middleware');

console.log(' R Definiendo rutas de Notificaciones...');

// Aplicar middleware de verificación de token a todas las rutas
router.use(verificarToken);
console.log(' R Middleware verificarToken aplicado a todas las rutas de notificaciones.');

// --- Rutas para Notificaciones ---
// GET /api/notificaciones - Obtener notificaciones
router.get('/', settingsController.obtenerNotificaciones);

// POST /api/notificaciones/:id/marcar-leida - Marcar notificación como leída
router.post('/:id/marcar-leida', settingsController.marcarLeida);

// POST /api/notificaciones/marcar-todas-leidas - Marcar todas las notificaciones como leídas
router.post('/marcar-todas-leidas', settingsController.marcarTodasLeidas);

console.log(' R Rutas de Notificaciones definidas.');
module.exports = router;