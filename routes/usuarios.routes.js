// routes/usuarios.routes.js
const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarios.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { esAdmin } = require('../middleware/role.middleware'); // Importa el middleware de rol

console.log(' R Definiendo rutas de Usuarios...');

// Aplicar verificación de token Y verificación de rol Admin a TODAS las rutas de usuarios
router.use(verificarToken);
router.use(esAdmin); // Solo Admins pueden continuar
console.log(' R Middlewares verificarToken y esAdmin aplicados a todas las rutas de usuarios.');

// --- Definir Rutas CRUD y específicas para Usuarios ---

// GET /api/usuarios - Listar todos los usuarios
router.get('/', usuarioController.listarUsuarios);

// POST /api/usuarios - Crear un nuevo usuario
router.post('/', usuarioController.crearUsuario);

// GET /api/usuarios/:id - Obtener un usuario específico por ID
router.get('/:id', usuarioController.obtenerUsuario);

// PUT /api/usuarios/:id - Actualizar datos básicos de un usuario (NO contraseña)
router.put('/:id', usuarioController.actualizarUsuario);

// DELETE /api/usuarios/:id - Eliminar un usuario específico por ID
router.delete('/:id', usuarioController.eliminarUsuario);

// PATCH /api/usuarios/:id/estado - Cambiar estado activo/inactivo
router.patch('/:id/estado', usuarioController.cambiarEstadoUsuario);

// PATCH /api/usuarios/:id/contrasena - Cambiar contraseña de un usuario
router.patch('/:id/contrasena', usuarioController.cambiarContrasenaUsuario);


console.log(' R Rutas de Usuarios definidas.');

module.exports = router;