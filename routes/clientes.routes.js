// routes/clientes.routes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clientes.controller'); // Importa el controlador de clientes
const { verificarToken } = require('../middleware/auth.middleware'); // Importa el middleware de autenticación

console.log(' R Definiendo rutas de Clientes...');

// Aplicar el middleware verificarToken a TODAS las rutas de este archivo
// Cualquier petición a /api/clientes/... primero pasará por verificarToken
router.use(verificarToken);
console.log(' R Middleware verificarToken aplicado a todas las rutas de clientes.');

// --- Definir Rutas CRUD para Clientes ---

// GET /api/clientes - Listar todos los clientes
router.get('/', clienteController.listarClientes);

// POST /api/clientes - Crear un nuevo cliente
router.post('/', clienteController.crearCliente);

// GET /api/clientes/:id - Obtener un cliente específico por ID
router.get('/:id', clienteController.obtenerCliente);

// PUT /api/clientes/:id - Actualizar un cliente específico por ID
router.put('/:id', clienteController.actualizarCliente);

// DELETE /api/clientes/:id - Eliminar un cliente específico por ID
router.delete('/:id', clienteController.eliminarCliente);

// GET /api/clientes/:id/servicios - Obtener los servicios de un cliente específico
router.get('/:id/servicios', clienteController.obtenerServiciosCliente);

console.log(' R Rutas de Clientes definidas.');

module.exports = router; // Exporta el router configurado