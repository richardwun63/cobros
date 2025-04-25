// controllers/usuarios.controller.js
const { Usuario, Rol } = require('../models');
const { Op } = require('sequelize');

console.log(' C Cargando controlador de Usuarios...');

// --- Listar todos los Usuarios ---
const listarUsuarios = async (req, res, next) => {
  console.log(' C Controlador: Petición GET a /api/usuarios recibida.');
  try {
    // Opcionalmente, añadir filtro por rol o estado si vienen en la query
    const where = {};
    
    if (req.query.rol_id) {
      where.rol_id = req.query.rol_id;
    }
    
    if (req.query.activo !== undefined) {
      where.activo = req.query.activo === 'true';
    }
    
    const usuarios = await Usuario.findAll({
      where,
      attributes: { exclude: ['contrasena_hash'] }, // Excluir el hash de la contraseña
      include: [{ // Incluir el rol
        model: Rol,
        as: 'rol',
        attributes: ['id', 'nombre_rol']
      }],
      order: [['nombre_usuario', 'ASC']]
    });
    console.log(' C Usuarios encontrados:', usuarios.length);
    res.status(200).json(usuarios);
  } catch (error) {
    console.error(' C Error al listar usuarios:', error);
    next(error);
  }
};

// --- Obtener un Usuario por ID ---
const obtenerUsuario = async (req, res, next) => {
  const usuarioId = req.params.id;
  console.log(` C Controlador: Petición GET a /api/usuarios/${usuarioId} recibida.`);
  try {
    const usuario = await Usuario.findByPk(usuarioId, {
       attributes: { exclude: ['contrasena_hash'] }, // Excluir hash
       include: [{ model: Rol, as: 'rol', attributes: ['id', 'nombre_rol'] }]
    });
    if (!usuario) {
      console.log(` C Usuario con ID ${usuarioId} no encontrado.`);
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    console.log(' C Usuario encontrado:', usuario.nombre_usuario);
    res.status(200).json(usuario);
  } catch (error) {
    console.error(` C Error al obtener usuario ${usuarioId}:`, error);
    next(error);
  }
};

// --- Crear un nuevo Usuario ---
const crearUsuario = async (req, res, next) => {
  const datosUsuario = req.body;
  console.log(' C Controlador: Petición POST a /api/usuarios recibida. Datos:', datosUsuario);
  try {
    // Validaciones básicas
    if (!datosUsuario.nombre_usuario || !datosUsuario.correo_electronico || !datosUsuario.contrasena_hash || !datosUsuario.rol_id) {
      console.log(' C Error: Faltan datos requeridos para crear usuario.');
      return res.status(400).json({ message: 'Faltan datos requeridos (usuario, email, contraseña, rol).' });
    }
    // Asegurarse de que 'contrasena_hash' se llame así para que el hook lo procese
    if (datosUsuario.password && !datosUsuario.contrasena_hash) {
        datosUsuario.contrasena_hash = datosUsuario.password;
    }


    const nuevoUsuario = await Usuario.create(datosUsuario);
    // No devolver el hash en la respuesta
    const { contrasena_hash, ...usuarioSinHash } = nuevoUsuario.get({ plain: true });

    console.log(' C Nuevo usuario creado con ID:', usuarioSinHash.id);
    res.status(201).json(usuarioSinHash);
  } catch (error) {
     if (error.name === 'SequelizeUniqueConstraintError') {
        console.error(' C Error de restricción única al crear usuario:', error.errors[0].message);
         return res.status(409).json({ message: 'Error al crear usuario: El nombre de usuario o correo electrónico ya existe.' });
     }
     if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.error(' C Error de clave foránea al crear usuario (rol inválido?):', error.message);
         return res.status(400).json({ message: 'Error al crear usuario: El rol especificado no existe.' });
     }
      if (error.name === 'SequelizeValidationError') {
         console.error(' C Error de validación de Sequelize:', error.errors.map(e => e.message));
         return res.status(400).json({ message: 'Datos inválidos.', errors: error.errors.map(e => e.message) });
     }
    console.error(' C Error al crear usuario:', error);
    next(error);
  }
};

// --- Actualizar un Usuario existente (sin contraseña) ---
const actualizarUsuario = async (req, res, next) => {
  const usuarioId = req.params.id;
  // Excluir la contraseña del cuerpo de la petición para esta función
  const { contrasena_hash, password, ...datosActualizar } = req.body;
  console.log(` C Controlador: Petición PUT a /api/usuarios/${usuarioId} recibida. Datos:`, datosActualizar);

  // No permitir actualizar la contraseña con esta ruta
   if (password || contrasena_hash) {
        console.warn(` C Intento de actualizar contraseña en ruta PUT /api/usuarios/${usuarioId}. Usar PATCH /contrasena.`);
       return res.status(400).json({ message: 'Para actualizar la contraseña, use la ruta específica PATCH /api/usuarios/:id/contrasena' });
   }


  try {
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      console.log(` C Usuario con ID ${usuarioId} no encontrado para actualizar.`);
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    await usuario.update(datosActualizar);

    // Obtener el usuario actualizado con su rol pero sin el hash
     const usuarioActualizado = await Usuario.findByPk(usuarioId, {
         attributes: { exclude: ['contrasena_hash'] },
         include: [{ model: Rol, as: 'rol', attributes: ['id', 'nombre_rol'] }]
     });

    console.log(` C Usuario con ID ${usuarioId} actualizado.`);
    res.status(200).json(usuarioActualizado);
  } catch (error) {
     if (error.name === 'SequelizeUniqueConstraintError') {
        console.error(' C Error de restricción única al actualizar usuario:', error.errors[0].message);
         return res.status(409).json({ message: 'Error al actualizar usuario: El nombre de usuario o correo electrónico ya existe para otro usuario.' });
     }
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.error(' C Error de clave foránea al actualizar usuario (rol inválido?):', error.message);
         return res.status(400).json({ message: 'Error al actualizar usuario: El rol especificado no existe.' });
     }
     if (error.name === 'SequelizeValidationError') {
         console.error(' C Error de validación de Sequelize:', error.errors.map(e => e.message));
         return res.status(400).json({ message: 'Datos inválidos.', errors: error.errors.map(e => e.message) });
     }
    console.error(` C Error al actualizar usuario ${usuarioId}:`, error);
    next(error);
  }
};

// --- Cambiar Estado (Activo/Inactivo) de un Usuario ---
const cambiarEstadoUsuario = async (req, res, next) => {
    const usuarioId = req.params.id;
    const { activo } = req.body; // Espera un body como { "activo": true } o { "activo": false }
    console.log(` C Controlador: Petición PATCH a /api/usuarios/${usuarioId}/estado. Nuevo estado: ${activo}`);

    if (typeof activo !== 'boolean') {
        console.log(' C Error: El campo "activo" debe ser true o false.');
       return res.status(400).json({ message: 'Formato incorrecto. Se requiere el campo "activo" (true o false).' });
    }

    try {
        const usuario = await Usuario.findByPk(usuarioId);
        if (!usuario) {
             console.log(` C Usuario con ID ${usuarioId} no encontrado para cambiar estado.`);
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Adicional: Prevenir que un admin se desactive a sí mismo si es el último admin activo
        if (req.usuario && parseInt(usuarioId) === req.usuario.userId && !activo) {
            const adminActivos = await Usuario.count({
                where: {
                    rol_id: 1, // ID de rol de administrador
                    activo: true,
                    id: { [Op.ne]: usuarioId } // Excluir el usuario actual
                }
            });
            
            if (adminActivos === 0) {
                console.warn(` C Intento de desactivar el último administrador activo (ID: ${usuarioId}).`);
                return res.status(403).json({ 
                    message: 'No se puede desactivar el último administrador activo del sistema.' 
                });
            }
        }

        await usuario.update({ activo: activo });
        console.log(` C Estado del usuario ${usuarioId} cambiado a ${activo}.`);

        // Devolver el usuario actualizado sin hash
        const usuarioActualizado = await Usuario.findByPk(usuarioId, {
             attributes: { exclude: ['contrasena_hash'] },
             include: [{ model: Rol, as: 'rol', attributes: ['id', 'nombre_rol'] }]
        });

        res.status(200).json(usuarioActualizado);

    } catch (error) {
        console.error(` C Error al cambiar estado del usuario ${usuarioId}:`, error);
        next(error);
    }
};

// --- Cambiar Contraseña de un Usuario ---
const cambiarContrasenaUsuario = async (req, res, next) => {
    const usuarioId = req.params.id;
    const { nuevaContrasena } = req.body; // Espera un body como { "nuevaContrasena": "password123" }
    console.log(` C Controlador: Petición PATCH a /api/usuarios/${usuarioId}/contrasena.`);

     if (!nuevaContrasena || typeof nuevaContrasena !== 'string' || nuevaContrasena.length < 6) { // Añadir validación de longitud mínima
        console.log(' C Error: Contraseña inválida o muy corta.');
        return res.status(400).json({ message: 'Se requiere una nueva contraseña válida (mínimo 6 caracteres).' });
    }

    try {
        const usuario = await Usuario.findByPk(usuarioId);
        if (!usuario) {
             console.log(` C Usuario con ID ${usuarioId} no encontrado para cambiar contraseña.`);
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Actualizar solo la contraseña. El hook 'beforeUpdate' en el modelo se encargará de hashearla.
        await usuario.update({ contrasena_hash: nuevaContrasena });

        console.log(` C Contraseña del usuario ${usuarioId} actualizada.`);
        res.status(200).json({ message: 'Contraseña actualizada correctamente.' }); // No devolver datos del usuario aquí

    } catch (error) {
        console.error(` C Error al cambiar contraseña del usuario ${usuarioId}:`, error);
        next(error);
    }

};


// --- Eliminar un Usuario ---
const eliminarUsuario = async (req, res, next) => {
  const usuarioId = req.params.id;
  console.log(` C Controlador: Petición DELETE a /api/usuarios/${usuarioId} recibida.`);
  try {
    // Prevenir que el admin se elimine a sí mismo
    if (parseInt(usuarioId, 10) === req.usuario.userId) {
        console.warn(` C Intento de auto-eliminación por usuario ID: ${usuarioId}.`);
        return res.status(403).json({ message: 'No puedes eliminar tu propia cuenta de administrador.' });
    }

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) {
      console.log(` C Usuario con ID ${usuarioId} no encontrado para eliminar.`);
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Verificar si es el último administrador antes de borrar
    if (usuario.rol_id === 1) { // Asumiendo que 1 es el ID del rol de administrador
        const adminCount = await Usuario.count({ 
            where: { 
                rol_id: 1,
                activo: true,
                id: { [Op.ne]: usuarioId } // No contar el usuario que se va a eliminar
            } 
        });
        
        if (adminCount === 0) {
            console.warn(` C Intento de eliminar el último administrador activo (ID: ${usuarioId}).`);
            return res.status(403).json({ 
                message: 'No se puede eliminar el último administrador activo del sistema.' 
            });
        }
    }

    await usuario.destroy();
    console.log(` C Usuario con ID ${usuarioId} eliminado.`);
    res.status(204).send();
  } catch (error) {
    console.error(` C Error al eliminar usuario ${usuarioId}:`, error);
    next(error);
  }
};


// Exportar todas las funciones
module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  cambiarEstadoUsuario,
  cambiarContrasenaUsuario
};

console.log(' C Controlador de Usuarios cargado.');