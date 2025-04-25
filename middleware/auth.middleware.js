// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config'); 
const { Usuario } = require('../models');
const authService = require('../services/auth.service');

console.log(' Mdl Cargando middleware de autenticación...');

const verificarToken = async (req, res, next) => {
  console.log(' Mdl Ejecutando verificación de token...');

  // 1. Obtener el token del header 'Authorization'
  const authHeader = req.headers['authorization'];
  
  // Forma flexible de obtener el token (Bearer o solo el token)
  let token = null;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      // Extrae el token quitando "Bearer "
      token = authHeader.substring(7, authHeader.length);
      console.log(' Mdl Token encontrado en header (formato Bearer).');
    } else {
      // Asume que el header contiene solo el token (menos estándar pero posible)
      token = authHeader;
      console.log(' Mdl Header Authorization encontrado, asumiendo que es el token.');
    }
  } else {
    console.log(' Mdl No se encontró el header Authorization.');
  }

  // 2. Verificar si el token existe
  if (!token) {
    console.log(' Mdl Acceso denegado: No se proporcionó token.');
    // 401 Unauthorized: Falta autenticación
    return res.status(401).json({ message: 'Acceso denegado. Se requiere token de autenticación.' });
  }

  try {
    // 3. Verificar la validez del token usando el servicio de autenticación
    console.log(' Mdl Verificando token...');
    let decoded;
    
    try {
      // Usar el servicio de autenticación para verificaciones avanzadas
      decoded = authService.verifyToken(token);
    } catch (authError) {
      // Manejar errores específicos del servicio de autenticación
      console.error(' Mdl Error del servicio de autenticación:', authError.message);
      
      if (authError.message.includes('expirado')) {
        return res.status(401).json({ message: 'Token expirado. Por favor, inicia sesión de nuevo.' });
      } else if (authError.message.includes('revocado')) {
        return res.status(401).json({ message: 'La sesión ha sido revocada. Por favor, inicia sesión de nuevo.' });
      } else {
        return res.status(403).json({ message: 'Token inválido.' });
      }
    }
    
    console.log(' Mdl Token válido. Payload decodificado:', decoded);

    // 4. Verificar si el usuario del token todavía existe en la BD
    try {
      const usuarioExiste = await Usuario.findByPk(decoded.userId);
      if (!usuarioExiste || !usuarioExiste.activo) {
        console.log(` Mdl Error: Usuario del token (ID: ${decoded.userId}) no existe o está inactivo.`);
        // 403 Forbidden: Autenticado pero no autorizado (usuario inválido)
        return res.status(403).json({ message: 'Token inválido (usuario no válido o inactivo).' });
      }
      console.log(` Mdl Usuario del token (ID: ${decoded.userId}) verificado en la BD.`);
    } catch (dbError) {
      console.error(' Mdl Error al verificar usuario en la BD:', dbError);
      // No fallamos la petición por este error, continuamos con la verificación básica
    }

    // 5. Añadir la información decodificada del usuario al objeto `req`
    req.usuario = decoded; // Ahora req.usuario contendrá { userId, username, rol }
    console.log(' Mdl Información del usuario añadida a req.usuario.');

    // 6. Registrar la acción de acceso (opcional, para auditoría)
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      await authService.registrarAccion(decoded.userId, 'acceso_api', {
        ruta: req.originalUrl,
        metodo: req.method,
        ip: clientIp
      });
    } catch (logError) {
      console.log(' Mdl Error al registrar acción (no crítico):', logError.message);
      // No interrumpimos el flujo por errores en el registro
    }

    // 7. Pasar al siguiente middleware o al controlador de la ruta
    next();
    console.log(' Mdl Verificación exitosa, pasando control a next().');

  } catch (error) {
    // 8. Manejar errores de verificación (token inválido, expirado, etc.)
    console.error(' Mdl Error al verificar el token:', error.name, error.message);
    if (error instanceof jwt.TokenExpiredError) {
      // 401 Unauthorized: Token expirado
      return res.status(401).json({ message: 'Token expirado. Por favor, inicia sesión de nuevo.' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      // 403 Forbidden: Token inválido o malformado
      return res.status(403).json({ message: 'Token inválido.' });
    }
    // Otros errores inesperados
    // 500 Internal Server Error
    return res.status(500).json({ message: 'Error interno al verificar la autenticación.' });
  }
};

// Middleware para verificar roles y permisos
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    console.log(' Mdl Verificando rol del usuario...');
    
    // Asegurarse de que req.usuario exista (verificarToken debe ejecutarse primero)
    if (!req.usuario) {
      return res.status(500).json({ message: 'Error de configuración: verificarToken debe ejecutarse antes de verificarRol.' });
    }
    
    // Verificar si el rol del usuario está en la lista de roles permitidos
    const rolUsuario = req.usuario.rol;
    
    // Si rolesPermitidos es una cadena, convertirla a un array
    const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    
    // Verificar si el rol del usuario está permitido
    if (roles.includes(rolUsuario) || rolUsuario === 'Administrador') {
      console.log(` Mdl Usuario con rol '${rolUsuario}' autorizado.`);
      next();
    } else {
      console.log(` Mdl Acceso denegado: Usuario con rol '${rolUsuario}' no tiene permisos suficientes.`);
      // 403 Forbidden: No tiene permisos para esta acción
      return res.status(403).json({ 
        message: 'Acceso denegado. No tienes permisos suficientes para esta acción.' 
      });
    }
  };
};

module.exports = {
  verificarToken, // Exportamos la función middleware de verificación de token
  verificarRol    // Exportamos la función middleware de verificación de rol
};

console.log(' Mdl Middleware de autenticación listo.');