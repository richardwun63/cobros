// models/Usuario.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs'); // Importamos bcrypt para hashear contraseñas

console.log(' M Definiendo modelo Usuario...');

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  nombre_usuario: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  correo_electronico: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { // Validación básica de email
      isEmail: true
    }
  },
  contrasena_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Guardar siempre hash de la contraseña, NUNCA texto plano'
  },
  nombre_completo: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  rol_id: { // Clave foránea para la tabla roles
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
        model: 'roles', // Nombre de la tabla referenciada
        key: 'id'
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'TRUE si el usuario está activo, FALSE si está desactivado'
  },
  // Sequelize añade createdAt y updatedAt por defecto si timestamps: true (que es el default)
}, {
  tableName: 'usuarios',
  timestamps: true, // Habilitar createdAt y updatedAt
  underscored: true, // Usar snake_case para createdAt y updatedAt (created_at, updated_at)
  createdAt: 'fecha_creacion', // Mapear createdAt a fecha_creacion
  updatedAt: 'ultima_modificacion', // Mapear updatedAt a ultima_modificacion
  comment: 'Almacena la información de los usuarios del sistema',

  // Hooks para hashear la contraseña antes de guardar
  hooks: {
    beforeCreate: async (usuario) => {
      if (usuario.contrasena_hash) {
        console.log(` M Hasheando contraseña para usuario nuevo: ${usuario.nombre_usuario}`);
        const salt = await bcrypt.genSalt(10); // Genera un salt
        usuario.contrasena_hash = await bcrypt.hash(usuario.contrasena_hash, salt); // Hashea la contraseña
      }
    },
    beforeUpdate: async (usuario) => {
      // Hashear solo si la contraseña ha sido modificada
      if (usuario.changed('contrasena_hash') && usuario.contrasena_hash) {
         console.log(` M Hasheando contraseña actualizada para usuario: ${usuario.nombre_usuario}`);
        const salt = await bcrypt.genSalt(10);
        usuario.contrasena_hash = await bcrypt.hash(usuario.contrasena_hash, salt);
      }
    }
  }
});

// Método de instancia para comparar contraseñas
Usuario.prototype.compararContrasena = async function(contrasenaPlana) {
    console.log(` M Comparando contraseña para usuario: ${this.nombre_usuario}`);
    return await bcrypt.compare(contrasenaPlana, this.contrasena_hash);
};


console.log(' M Modelo Usuario definido.');

module.exports = Usuario;