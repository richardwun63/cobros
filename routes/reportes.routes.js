// routes/reportes.routes.js
const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reportes.controller');
const { verificarToken } = require('../middleware/auth.middleware');

console.log(' R Definiendo rutas de Reportes...');

// Proteger todas las rutas de reportes con autenticación
router.use(verificarToken);
console.log(' R Middleware verificarToken aplicado a todas las rutas de reportes.');

// --- Definir Rutas para Reportes ---

// GET /api/reportes/dashboard - Obtener resumen general del dashboard
router.get('/dashboard', reporteController.generarDashboardGeneral);

// GET /api/reportes/resumen-pagos?periodo=current-month (o previous-month, quarter, year, last-30-days, last-90-days)
router.get('/resumen-pagos', reporteController.generarResumenPagos);

// GET /api/reportes/estado-clientes - Obtener informe sobre estado de todos los clientes
router.get('/estado-clientes', reporteController.generarEstadoClientes);

// GET /api/reportes/analisis-atrasos - Obtener análisis detallado de cobros atrasados
router.get('/analisis-atrasos', reporteController.generarAnalisisAtrasos);

// GET /api/reportes/proyeccion-ingresos - Obtener proyección de ingresos futuros
router.get('/proyeccion-ingresos', reporteController.generarProyeccionIngresos);

// GET /api/reportes/analisis-rentabilidad - Obtener análisis de rentabilidad por servicio
router.get('/analisis-rentabilidad', reporteController.generarAnalisisRentabilidad);

console.log(' R Rutas de Reportes definidas.');

module.exports = router;