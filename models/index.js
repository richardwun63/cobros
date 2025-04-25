// models/index.js
const { sequelize } = require('../config/database');

console.log(' M Cargando modelos...');

// Importar todos los modelos definidos
const Rol = require('./Rol');
const Usuario = require('./Usuario');
const Cliente = require('./Cliente');
const Servicio = require('./Servicio');
const Cobro = require('./Cobro');
const Configuracion = require('./Configuracion');

console.log(' M Modelos importados.');

// --- Definir Asociaciones ---
console.log(' M Definiendo asociaciones entre modelos...');

// Relación Rol <-> Usuario (Un Rol tiene muchos Usuarios, un Usuario pertenece a un Rol)
Rol.hasMany(Usuario, { foreignKey: 'rol_id', as: 'usuarios' });
Usuario.belongsTo(Rol, { foreignKey: 'rol_id', as: 'rol' });

// Relación Cliente <-> Cobro (Un Cliente tiene muchos Cobros, un Cobro pertenece a un Cliente)
Cliente.hasMany(Cobro, { foreignKey: 'cliente_id', as: 'cobros' });
Cobro.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });

// Relación Servicio <-> Cobro (Un Servicio puede estar en muchos Cobros, un Cobro pertenece a un Servicio - Opcional)
Servicio.hasMany(Cobro, { foreignKey: 'servicio_id', as: 'cobros_asociados' });
Cobro.belongsTo(Servicio, { foreignKey: 'servicio_id', as: 'servicio' });

console.log(' M Asociaciones definidas.');

// Exportar la conexión y todos los modelos
console.log(' M Exportando conexión y modelos...');
module.exports = {
  db: sequelize,
  sequelize,
  Rol,
  Usuario,
  Cliente,
  Servicio,
  Cobro,
  Configuracion,
};
console.log(' M Exportación de modelos completa.');