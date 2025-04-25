// Importar las configuraciones individuales
const databaseConfig = require('./database');
const jwtConfig = require('./jwt');

console.log('🔄 Cargando configuraciones...');

// Exportar un objeto que contenga todas las configuraciones
module.exports = {
  database: databaseConfig.sequelize, // Exportamos directamente la instancia de sequelize
  sequelize: databaseConfig.sequelize, // Exportamos directamente la instancia de sequelize (duplicado para compatibilidad)
  testDbConnection: databaseConfig.testConnection, // Exportamos la función de testeo
  jwt: jwtConfig
};

console.log('👍 Configuraciones cargadas.');