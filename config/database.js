// Importar las variables de entorno (para leer el .env)
require('dotenv').config();
// Importar Sequelize
const { Sequelize } = require('sequelize');

// Obtener las credenciales de la base de datos desde las variables de entorno
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT; // Puerto añadido

console.log('--- Configuración de Base de Datos ---');
console.log(`DB_NAME: ${dbName}`);
console.log(`DB_USER: ${dbUser}`);
console.log(`DB_HOST: ${dbHost}`);
console.log(`DB_PORT: ${dbPort}`);
console.log('--------------------------------------');

// Crear una instancia de Sequelize para la conexión
const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort, // Especificar el puerto
  dialect: 'mysql', // Indicar que usamos MySQL
  logging: console.log, // Muestra las consultas SQL en la consola (útil para debug)
  // logging: false, // Descomentar esto en producción para no llenar la consola
  pool: { // Configuración opcional del pool de conexiones
    max: 5, // Máximo de conexiones
    min: 0, // Mínimo de conexiones
    acquire: 30000, // Tiempo máximo para obtener una conexión (ms)
    idle: 10000 // Tiempo máximo que una conexión puede estar inactiva (ms)
  },
  // Configuración específica para MySQL 8
  dialectOptions: {
    // Para manejar correctamente la zonas horarias
    timezone: '-05:00', // Ajustado para Perú/Lima (UTC-5)
    // Aumentar el límite de tamaño de paquetes
    maxPacketSize: 1073741824 // 1GB (valor máximo permitido)
  }
}); 

// Función asíncrona para probar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente.');
  } catch (error) {
    console.error('❌ No se pudo conectar a la base de datos:', error);
    // Podrías querer terminar el proceso si la conexión falla al inicio
    // process.exit(1);
  }
};

// Exportar la instancia de sequelize y la función de testeo
module.exports = {
  sequelize,
  testConnection
};