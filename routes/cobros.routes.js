// routes/cobros.routes.js
const express = require('express');
const router = express.Router();
const cobroController = require('../controllers/cobros.controller');
const { verificarToken } = require('../middleware/auth.middleware');

console.log(' R Definiendo rutas de Cobros...');

// Aplicar middleware de autenticación a todas las rutas de cobros
router.use(verificarToken);
console.log(' R Middleware verificarToken aplicado a todas las rutas de cobros.');

// --- Definir Rutas CRUD para Cobros ---

// GET /api/cobros - Listar todos los cobros (con posibles filtros query)
router.get('/', cobroController.listarCobros);

// POST /api/cobros - Crear un nuevo cobro
router.post('/', cobroController.crearCobro);

// GET /api/cobros/:id - Obtener un cobro específico por ID
router.get('/:id', cobroController.obtenerCobro);

// PUT /api/cobros/:id - Actualizar un cobro específico por ID
router.put('/:id', cobroController.actualizarCobro);

// DELETE /api/cobros/:id - Eliminar un cobro específico por ID
router.delete('/:id', cobroController.eliminarCobro);

console.log(' R Rutas de Cobros definidas.');

module.exports = router;