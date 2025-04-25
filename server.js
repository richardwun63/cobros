// Importar dotenv para cargar variables de entorno desde .env
require('dotenv').config();

// Importar módulos necesarios
const express = require('express');
const cors = require('cors');
const path = require('path'); // Añadido para manejar rutas de archivos
const fs = require('fs'); // Añadido para verificar si los archivos existen

// Importar la configuración unificada (incluye DB y JWT)
const config = require('./config'); // Esto carga config/index.js por defecto

// Importar el enrutador principal
const apiRouter = require('./routes'); // Esto cargará routes/index.js

console.log('🚀 Iniciando servidor...');

// Crear la aplicación Express
const app = express();

// --- Configuración de Middleware ---

// Habilitar CORS (Cross-Origin Resource Sharing)
app.use(cors());
console.log('🔗 CORS habilitado.');

// Middleware para parsear JSON en el cuerpo de las peticiones
app.use(express.json());
console.log('📦 Middleware para JSON habilitado.');

// Middleware para parsear datos de formularios URL-encoded
app.use(express.urlencoded({ extended: true }));
console.log('📃 Middleware para URL-encoded habilitado.');

// Establecer tipo MIME correcto para distintos tipos de archivos
app.use(function(req, res, next) {
  const ext = path.extname(req.url).toLowerCase();
  if (ext === '.js') {
    res.type('application/javascript');
  } else if (ext === '.css') {
    res.type('text/css');
  }
  next();
});

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
console.log('🌐 Middleware para archivos estáticos habilitado.');

// --- Conexión a la Base de Datos ---
config.testDbConnection();

// --- Rutas de la API ---

// Montar el enrutador principal de la API bajo el prefijo /api
app.use('/api', apiRouter);
console.log('🛣️ Rutas de la API montadas bajo /api');

// IMPORTANTE: Verificar si es una solicitud de archivo antes de redirigir a index.html
app.get('*', (req, res, next) => {
  // Si es una solicitud de API, continuar con el siguiente middleware
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  // Si es una solicitud de archivo con extensión conocida, primero verificar si existe
  const ext = path.extname(req.path).toLowerCase();
  if (['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
    const filePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  
  // Si no es un archivo estático existente, servir index.html (SPA)
  console.log(`ℹ️ Acceso a ruta frontend: ${req.path} - Redirigiendo a index.html`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Middleware de Manejo de Errores (Básico) ---
app.use((err, req, res, next) => {
  console.error('💥 Ocurrió un error no controlado:');
  console.error(err.stack || err);
  res.status(err.status || 500).json({
    message: err.message || 'Ocurrió un error interno en el servidor.',
  });
});

// --- Iniciar el Servidor ---
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en el puerto ${PORT}`);
  console.log(` R HORA Y FECHA: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`);
  console.log('✨ ¡Backend listo para recibir peticiones!');
});

// Manejo de cierre inesperado
process.on('uncaughtException', (error) => {
  console.error('💥 EXCEPCIÓN NO CAPTURADA:');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚫 RECHAZO DE PROMESA NO MANEJADO:');
  console.error('Promesa:', promise, 'Razón:', reason);
});