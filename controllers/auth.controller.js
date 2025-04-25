// controllers/auth.controller.js
const authService = require('../services/auth.service');
const logger = require('../utils/logger.util');

console.log(' C Cargando controlador de autenticación...');

// Función para manejar el inicio de sesión
const login = async (req, res, next) => {
  console.log(' C Petición POST a /api/auth/login recibida.');
  // 1. Extraer credenciales del cuerpo de la petición
  const { username, password } = req.body; // Asumimos que el frontend envía 'username' y 'password'
  console.log(` C Intentando iniciar sesión con usuario: ${username}`);

  try {
    // 2. Validar entrada básica
    if (!username || !password) {
      console.log(' C Error: Faltan credenciales (usuario o contraseña).');
      return res.status(400).json({ message: 'Por favor, ingresa usuario y contraseña.' });
    }

    // 3. Usar el servicio de autenticación para verificar credenciales
    const authResult = await authService.login(username, password);

    console.log(` C Credenciales válidas para usuario: ${authResult.usuario.username}. Token generado.`);

    // 4. Enviar respuesta exitosa con el token y datos del usuario
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token: authResult.token,
      usuario: authResult.usuario
    });

  } catch (error) {
    // 5. Manejo de errores específicos
    console.error(' C Error en el proceso de login:', error.message);
    
    // Determinar el tipo de error para enviar respuesta adecuada
    if (error.message.includes('Credenciales incorrectas') || 
        error.message.includes('cuenta de usuario está inactiva')) {
      return res.status(401).json({ message: error.message });
    } else {
      // Otros errores inesperados
      next(error);
    }
  }
};

// Función para verificar token
const verificarToken = async (req, res) => {
  try {
    // Obtener el token del header
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, message: 'Token no proporcionado.' });
    }
    
    const token = authHeader.substring(7);
    
    // Verificar el token
    const decoded = await authService.verifyToken(token);
    
    res.status(200).json({
      valid: true,
      usuario: {
        id: decoded.userId,
        username: decoded.username,
        rol: decoded.rol
      }
    });
  } catch (error) {
    console.error(' C Error en verificación de token:', error.message);
    
    // Si el token ha expirado o es inválido
    if (error.message.includes('expirado') || error.message.includes('inválido')) {
      return res.status(401).json({ 
        valid: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({
      valid: false,
      message: 'Error al verificar token.'
    });
  }
};

// Función para solicitar restablecimiento de contraseña
const solicitarRestablecerContrasena = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Se requiere un correo electrónico.' });
  }
  
  try {
    // Generar token de restablecimiento
    const resetTokenInfo = await authService.generateResetToken(email);
    
    // Aquí se podría implementar el envío de correo con el token
    // En este ejemplo simplemente devolvemos el token (en producción nunca hacer esto)
    
    res.status(200).json({
      message: 'Solicitud de restablecimiento de contraseña procesada. Revise su correo electrónico.',
      // Solo en entorno de desarrollo:
      ...(process.env.NODE_ENV !== 'production' && { resetToken: resetTokenInfo.token })
    });
  } catch (error) {
    console.error(' C Error al solicitar restablecimiento de contraseña:', error.message);
    
    // No revelar si el email existe o no por seguridad
    res.status(200).json({
      message: 'Si su correo está registrado, recibirá un enlace para restablecer su contraseña.'
    });
  }
};

// Función para cambiar contraseña con token
const restablecerContrasena = async (req, res, next) => {
  const { token, nuevaContrasena } = req.body;
  
  if (!token || !nuevaContrasena) {
    return res.status(400).json({ 
      message: 'Se requiere token y nueva contraseña.' 
    });
  }
  
  try {
    // Verificar el token
    const decoded = await authService.verifyToken(token);
    
    // Verificar que el token sea para restablecimiento de contraseña
    if (decoded.purpose !== 'password_reset') {
      return res.status(401).json({ 
        message: 'Token inválido para restablecimiento de contraseña.' 
      });
    }
    
    // Cambiar la contraseña
    await authService.cambiarContrasena(decoded.userId, nuevaContrasena);
    
    res.status(200).json({
      message: 'Contraseña restablecida correctamente.'
    });
  } catch (error) {
    console.error(' C Error al restablecer contraseña:', error.message);
    
    if (error.message.includes('Contraseña débil')) {
      return res.status(400).json({ message: error.message });
    } else if (error.message.includes('expirado') || error.message.includes('inválido')) {
      return res.status(401).json({ message: 'Token inválido o expirado. Solicite un nuevo restablecimiento.' });
    }
    
    next(error);
  }
};

// Exportar las funciones del controlador
module.exports = {
  login,
  verificarToken,
  solicitarRestablecerContrasena,
  restablecerContrasena
};

console.log(' C Controlador de autenticación cargado.');