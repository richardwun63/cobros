// routes/servicios.routes.js
const express = require('express');
const router = express.Router();
const serviciosController = require('../controllers/servicios.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { verificarRol } = require('../middleware/role.middleware');
const validationMiddleware = require('../middleware/validation.middleware');

console.log(' R Definiendo rutas de Servicios...');

// Aplicar middleware de autenticación a todas las rutas
router.use(verificarToken);
console.log(' R Middleware verificarToken aplicado a todas las rutas de servicios.');

// --- Rutas para servicios ---

// GET /api/servicios - Listar todos los servicios
router.get('/', serviciosController.listarServicios);

// GET /api/servicios/:id - Obtener un servicio específico
router.get('/:id', validationMiddleware.validarId, serviciosController.obtenerServicio);

// POST /api/servicios - Crear un nuevo servicio (solo administradores)
router.post(
    '/', 
    verificarRol(['Administrador']), 
    validationMiddleware.validarCreacionServicio, 
    serviciosController.crearServicio
);

// PUT /api/servicios/:id - Actualizar un servicio existente (solo administradores)
router.put(
    '/:id',
    validationMiddleware.validarId,
    verificarRol(['Administrador']),
    validationMiddleware.validarCreacionServicio,
    serviciosController.actualizarServicio
);

// DELETE /api/servicios/:id - Eliminar un servicio (solo administradores)
router.delete(
    '/:id',
    validationMiddleware.validarId,
    verificarRol(['Administrador']),
    serviciosController.eliminarServicio
);

// GET /api/servicios/:id/estadisticas - Obtener estadísticas de un servicio
router.get(
    '/:id/estadisticas',
    validationMiddleware.validarId,
    serviciosController.obtenerEstadisticasServicio
);

console.log(' R Rutas de Servicios definidas.');

module.exports = router;