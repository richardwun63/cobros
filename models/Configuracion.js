// models/Configuracion.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

console.log(' M Definiendo modelo Configuracion...');

const Configuracion = sequelize.define('Configuracion', {
  clave: {
    type: DataTypes.STRING(100),
    primaryKey: true, // La clave será la llave primaria
    allowNull: false,
    unique: true
  },
  valor: {
    type: DataTypes.TEXT, // Usar TEXT para guardar valores diversos (JSON, strings largos, etc.)
    allowNull: true
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
  // ultima_modificacion manejado por timestamps
}, {
  tableName: 'configuraciones',
  timestamps: true, // Queremos saber cuándo se modificó por última vez
  updatedAt: 'ultima_modificacion',
  createdAt: false, // No necesitamos createdAt aquí
  underscored: true,
  comment: 'Almacena configuraciones generales del sistema'
});

console.log(' M Modelo Configuracion definido.');

module.exports = Configuracion;