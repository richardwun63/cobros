// models/Cliente.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

console.log(' M Definiendo modelo Cliente...');

const Cliente = sequelize.define('Cliente', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  nombre_cliente: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  ruc_dni: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    comment: 'RUC o DNI del cliente'
  },
  telefono: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  correo_electronico: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true // Validación básica opcional
    }
  },
  direccion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  estado_cliente: {
    type: DataTypes.ENUM('Activo', 'Inactivo', 'Pendiente', 'Atrasado'),
    allowNull: false,
    defaultValue: 'Activo',
    comment: 'Estado general del cliente, podría derivarse de sus pagos'
  }
  // fecha_registro y ultima_actualizacion manejados por timestamps
}, {
  tableName: 'clientes',
  timestamps: true,
  underscored: true,
  createdAt: 'fecha_registro',
  updatedAt: 'ultima_actualizacion',
  comment: 'Almacena la información de los clientes'
});

console.log(' M Modelo Cliente definido.');

module.exports = Cliente;