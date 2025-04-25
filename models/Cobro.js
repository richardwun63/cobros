// models/Cobro.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

console.log(' M Definiendo modelo Cobro...');

const Cobro = sequelize.define('Cobro', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  cliente_id: { // FK a Clientes
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
     references: {
        model: 'clientes',
        key: 'id'
    }
  },
  servicio_id: { // FK a Servicios (puede ser nulo)
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
     references: {
        model: 'servicios',
        key: 'id'
    }
  },
  descripcion_servicio_personalizado: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Para el caso de servicio Otro o descripción específica'
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  moneda: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'PEN',
    comment: 'Código ISO de la moneda (Ej: PEN, USD)'
  },
  fecha_emision: {
    type: DataTypes.DATEONLY, // Usar DATEONLY si no necesitas la hora
    allowNull: false
  },
  fecha_vencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  estado_cobro: {
    type: DataTypes.ENUM('Pagado', 'Pendiente', 'Atrasado', 'Anulado'),
    allowNull: false,
    defaultValue: 'Pendiente'
  },
  fecha_pago: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Fecha en que se registró el pago'
  },
  metodo_pago: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Ej: Transferencia, Efectivo, Yape, Plin'
  },
  numero_referencia: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Número de operación, ID de transacción, etc.'
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  }
  // fecha_creacion y ultima_modificacion manejados por timestamps
}, {
  tableName: 'cobros',
  timestamps: true,
  underscored: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'ultima_modificacion',
  comment: 'Registros de cobros emitidos a los clientes'
});

console.log(' M Modelo Cobro definido.');

module.exports = Cobro;