// routes/index.js
const express = require('express');
const router = express.Router();

// Importar enrutadores específicos
const authRoutes = require('./auth.routes');
const clientesRoutes = require('./clientes.routes');
const cobrosRoutes = require('./cobros.routes');
const serviciosRoutes = require('./servicios.routes');
const reportesRoutes = require('./reportes.routes');
const settingsRoutes = require('./settings.routes');
const notificacionesRoutes = require('./notificaciones.routes');
const usuariosRoutes = require('./usuarios.routes'); // Importante: asegúramos que esta línea existe

console.log(' R Creando enrutador principal...');

// Montar enrutadores para los diferentes recursos
// Autenticación
router.use('/auth', authRoutes);
console.log(' R Montando /api/auth...');

// Clientes
router.use('/clientes', clientesRoutes);
console.log(' R Montando /api/clientes...');

// Cobros
router.use('/cobros', cobrosRoutes);
console.log(' R Montando /api/cobros...');

// Servicios
router.use('/servicios', serviciosRoutes);
console.log(' R Montando /api/servicios...');

// Reportes
router.use('/reportes', reportesRoutes);
console.log(' R Montando /api/reportes...');

// Configuraciones
router.use('/settings', settingsRoutes);
console.log(' R Montando /api/settings...');

// Notificaciones (usando un router separado)
router.use('/notificaciones', notificacionesRoutes);
console.log(' R Montando /api/notificaciones...');

// Usuarios - Aseguramos que se monte correctamente
router.use('/usuarios', usuariosRoutes);
console.log(' R Montando /api/usuarios...');

// Opcionalmente, ruta de verificación de estado de la API
router.get('/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    appName: 'PEGASUS API',
    version: '1.0.0'
  });
});

module.exports = router;