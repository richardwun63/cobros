// models/Servicio.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

console.log(' M Definiendo modelo Servicio...');

const Servicio = sequelize.define('Servicio', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  nombre_servicio: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  precio_base: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Precio estándar del servicio si aplica'
  }
}, {
  tableName: 'servicios',
  timestamps: false, // Asumiendo que no necesitas timestamps aquí
  underscored: true,
  comment: 'Catálogo de servicios ofrecidos'
});

console.log(' M Modelo Servicio definido.');

module.exports = Servicio;