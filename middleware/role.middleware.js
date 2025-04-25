// middleware/role.middleware.js
const logger = require('../utils/logger.util');
const authService = require('../services/auth.service');

console.log(' Mdl Cargando middleware de roles...');

/**
 * Middleware para verificar si el usuario tiene rol de administrador
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar con el siguiente middleware
 */
const esAdmin = async (req, res, next) => {
    // Si no hay usuario en la petición, denegar acceso
    if (!req.usuario) {
        logger.error('Error de configuración: verificarToken debe ejecutarse antes de esAdmin.');
        return res.status(401).json({
            message: 'Acceso denegado. Se requiere autenticación.'
        });
    }

    try {
        // Ya tenemos información del usuario desde verificarToken, que lo incluyó en req.usuario
        const rol = req.usuario.rol;

        // Verificar si es administrador
        if (rol === 'Administrador') {
            console.log(` Mdl Usuario ${req.usuario.username} verificado como Administrador.`);
            next(); // Continuar con la petición
        } else {
            logger.warn(`Acceso denegado: Usuario '${req.usuario.username}' con rol '${rol}' intentó acceder a ruta restringida.`);
            res.status(403).json({
                message: 'Acceso denegado. Se requiere rol de Administrador.'
            });
        }
    } catch (error) {
        logger.error('Error verificando rol:', error);
        res.status(500).json({
            message: 'Error al verificar permisos de acceso.'
        });
    }
};

/**
 * Middleware para verificar si el usuario tiene cualquiera de los roles especificados
 * @param {Array} roles - Array de nombres de roles permitidos
 * @returns {Function} Middleware de Express
 */
const verificarRol = (roles) => {
    return async (req, res, next) => {
        if (!req.usuario) {
            logger.error('Error de configuración: verificarToken debe ejecutarse antes de verificarRol.');
            return res.status(401).json({
                message: 'Acceso denegado. Se requiere autenticación.'
            });
        }

        try {
            // Ya tenemos información del usuario desde verificarToken
            const rol = req.usuario.rol;

            // El rol Administrador siempre tiene acceso
            if (rol === 'Administrador') {
                console.log(` Mdl Usuario ${req.usuario.username} es Administrador, acceso permitido.`);
                return next();
            }

            // Verificar si el rol del usuario está en la lista de roles permitidos
            if (roles.includes(rol)) {
                console.log(` Mdl Usuario ${req.usuario.username} verificado con rol permitido: ${rol}`);
                next(); // Continuar con la petición
            } else {
                logger.warn(`Acceso denegado: Usuario '${req.usuario.username}' con rol '${rol}' no tiene permisos.`);
                res.status(403).json({
                    message: 'Acceso denegado. No tienes los permisos necesarios.'
                });
            }
        } catch (error) {
            logger.error('Error verificando rol:', error);
            res.status(500).json({
                message: 'Error al verificar permisos de acceso.'
            });
        }
    };
};

/**
 * Middleware para verificar si el usuario tiene permisos específicos (más granular que roles)
 * @param {string|Array} permisosRequeridos - Permiso o lista de permisos requeridos
 * @returns {Function} - Función middleware
 */
const verificarPermiso = (permisosRequeridos) => {
  return async (req, res, next) => {
    console.log(' Mdl Verificando permisos específicos del usuario...');
    
    // Asegurarse de que req.usuario exista
    if (!req.usuario) {
      logger.error('Error de configuración: verificarToken debe ejecutarse antes de verificarPermiso.');
      return res.status(500).json({ 
        message: 'Error de configuración: verificarToken debe ejecutarse antes de verificarPermiso.' 
      });
    }
    
    try {
      const userId = req.usuario.userId;
      const rolUsuario = req.usuario.rol;
      
      // El rol Administrador tiene todos los permisos
      if (rolUsuario === 'Administrador') {
        console.log(' Mdl Usuario con rol Administrador tiene todos los permisos.');
        return next();
      }
      
      // Convertir a array si es un string
      const permisos = Array.isArray(permisosRequeridos) ? permisosRequeridos : [permisosRequeridos];
      
      // Obtener permisos del usuario desde la base de datos
      const permisosUsuario = await obtenerPermisosUsuario(userId, rolUsuario);
      
      // Verificar si tiene al menos uno de los permisos requeridos
      const tienePermiso = permisos.some(permiso => permisosUsuario.includes(permiso));
      
      if (tienePermiso) {
        console.log(` Mdl Usuario con permisos '${permisosUsuario.join(', ')}' autorizado.`);
        next();
      } else {
        logger.warn(`Acceso denegado: Usuario '${req.usuario.username}' no tiene permisos '${permisos.join(', ')}'.`);
        return res.status(403).json({ 
          message: 'Acceso denegado. No tienes los permisos requeridos para esta acción.' 
        });
      }
    } catch (error) {
      logger.error('Error al verificar permisos:', error);
      return res.status(500).json({ message: 'Error al verificar permisos.' });
    }
  };
};

/**
 * Obtiene los permisos de un usuario según su rol
 * @param {number} userId - ID del usuario
 * @param {string} rolNombre - Nombre del rol
 * @returns {Promise<Array>} - Lista de permisos
 */
async function obtenerPermisosUsuario(userId, rolNombre) {
  // Esta función debería obtener los permisos de la base de datos según el rol
  // En esta implementación básica, definimos permisos predeterminados por rol
  
  // Mapa de permisos por rol
  const permisosRol = {
    'Administrador': [
      'usuarios_crear', 'usuarios_leer', 'usuarios_actualizar', 'usuarios_eliminar',
      'clientes_crear', 'clientes_leer', 'clientes_actualizar', 'clientes_eliminar',
      'cobros_crear', 'cobros_leer', 'cobros_actualizar', 'cobros_eliminar',
      'servicios_crear', 'servicios_leer', 'servicios_actualizar', 'servicios_eliminar',
      'reportes_generar', 'reportes_exportar',
      'configuracion_leer', 'configuracion_actualizar',
      'backup_crear', 'backup_restaurar'
    ],
    'Usuario': [
      'usuarios_leer',
      'clientes_crear', 'clientes_leer', 'clientes_actualizar',
      'cobros_crear', 'cobros_leer', 'cobros_actualizar',
      'servicios_leer',
      'reportes_generar', 'reportes_exportar',
      'configuracion_leer'
    ]
  };
  
  // Obtener permisos según el rol
  const permisos = permisosRol[rolNombre] || [];
  
  // Buscar permisos adicionales específicos del usuario (si existieran)
  // En una implementación completa, aquí se consultaría la base de datos
  
  return permisos;
}

/**
 * Middleware para requerir usuario propietario (para editar recursos propios)
 * @param {Function} getResourceUserId - Función para obtener el ID de usuario del recurso
 * @returns {Function} - Función middleware
 */
const verificarPropietario = (getResourceUserId) => {
  return async (req, res, next) => {
    console.log(' Mdl Verificando propiedad del recurso...');
    
    // Asegurarse de que req.usuario exista
    if (!req.usuario) {
      logger.error('Error de configuración: verificarToken debe ejecutarse antes de verificarPropietario.');
      return res.status(500).json({ 
        message: 'Error de configuración: verificarToken debe ejecutarse antes de verificarPropietario.' 
      });
    }
    
    try {
      const userId = req.usuario.userId;
      const rolUsuario = req.usuario.rol;
      
      // El rol Administrador puede acceder a cualquier recurso
      if (rolUsuario === 'Administrador') {
        console.log(' Mdl Usuario con rol Administrador puede acceder a todos los recursos.');
        return next();
      }
      
      // Obtener el ID de usuario del recurso
      const resourceUserId = await getResourceUserId(req);
      
      // Si no se pudo obtener el ID del recurso, denegar acceso
      if (resourceUserId === null || resourceUserId === undefined) {
        logger.warn('No se pudo determinar el propietario del recurso.');
        return res.status(403).json({ message: 'Acceso denegado. No se pudo verificar propiedad del recurso.' });
      }
      
      // Verificar si el usuario es el propietario del recurso
      if (userId === resourceUserId) {
        console.log(` Mdl Usuario ${userId} es propietario del recurso.`);
        next();
      } else {
        logger.warn(`Acceso denegado: Usuario ${userId} no es propietario del recurso ${resourceUserId}.`);
        return res.status(403).json({ 
          message: 'Acceso denegado. Solo puedes acceder a tus propios recursos.' 
        });
      }
    } catch (error) {
      logger.error('Error al verificar propiedad del recurso:', error);
      return res.status(500).json({ message: 'Error al verificar propiedad del recurso.' });
    }
  };
};

// Exportar todos los middleware
module.exports = {
  esAdmin,
  verificarRol,
  verificarPermiso,
  verificarPropietario
};

console.log(' Mdl Middleware de roles listo.');