// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller'); // Importa el controlador
const { validarResultados } = require('../middleware/validation.middleware');

console.log(' R Definiendo rutas de autenticación...');

// Definir la ruta para el Login
// Usará el método POST porque el frontend enviará datos (usuario/contraseña) en el cuerpo
router.post('/login', authController.login);

// Ruta para verificar token
router.get('/verificar', authController.verificarToken);

// Rutas para restablecimiento de contraseña
router.post('/solicitar-reset', authController.solicitarRestablecerContrasena);
router.post('/reset-password', authController.restablecerContrasena);

console.log(' R Rutas de autenticación definidas.');

module.exports = router; // Exporta el router configurado