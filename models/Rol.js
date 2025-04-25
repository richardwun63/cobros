// models/Rol.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

console.log(' M Definiendo modelo Rol...');

const Rol = sequelize.define('Rol', {
  // Los atributos del modelo se definen aquí
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  nombre_rol: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Ej: Administrador, Usuario'
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  // Otras opciones del modelo
  tableName: 'roles', // Nombre exacto de la tabla en la BD
  timestamps: false, // No queremos las columnas createdAt y updatedAt automáticas para esta tabla
  underscored: true, // Opcional: si quieres que Sequelize use snake_case para las columnas generadas automáticamente (como claves foráneas)
  comment: 'Almacena los roles de los usuarios del sistema'
});

console.log(' M Modelo Rol definido.');

module.exports = Rol;