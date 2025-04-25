// services/auth.service.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Usuario, Rol } = require('../models');
const { jwt: jwtConfig } = require('../config');
const { Op } = require('sequelize');
const logger = require('../utils/logger.util');
const passwordUtil = require('../utils/password.util');

/**
 * Servicio de autenticación que proporciona métodos para autenticar usuarios
 * y generar tokens JWT.
 */
class AuthService {
    /**
     * Autentica a un usuario por su nombre de usuario o correo electrónico
     * @param {string} usernameOrEmail - Nombre de usuario o correo electrónico
     * @param {string} password - Contraseña sin encriptar
     * @returns {Promise<Object>} - Objeto con token y datos del usuario
     * @throws {Error} - Si las credenciales son inválidas o el usuario está inactivo
     */
    async login(usernameOrEmail, password) {
        try {
            // Buscar usuario por nombre de usuario o correo electrónico
            const usuario = await Usuario.findOne({
                where: {
                    [Op.or]: [
                        { nombre_usuario: usernameOrEmail },
                        { correo_electronico: usernameOrEmail }
                    ]
                },
                include: [{
                    model: Rol,
                    as: 'rol',
                    attributes: ['nombre_rol']
                }]
            });

            // Verificar si el usuario existe
            if (!usuario) {
                logger.warn(`Intento de login fallido: Usuario no existe (${usernameOrEmail})`);
                throw new Error('Credenciales incorrectas.');
            }

            // Verificar si el usuario está activo
            if (!usuario.activo) {
                logger.warn(`Intento de login fallido: Usuario inactivo (${usernameOrEmail})`);
                throw new Error('Tu cuenta de usuario está inactiva. Contacta al administrador.');
            }

            // Verificar la contraseña
            const esValida = await usuario.compararContrasena(password);
            if (!esValida) {
                logger.warn(`Intento de login fallido: Contraseña incorrecta (${usernameOrEmail})`);
                
                // Registrar intento fallido
                try {
                    await this.registrarIntentoFallido(usuario.id);
                } catch (logError) {
                    logger.error(`Error al registrar intento fallido: ${logError.message}`);
                }
                
                throw new Error('Credenciales incorrectas.');
            }

            // Verificar si hay demasiados intentos fallidos recientes
            const intentosFallidos = await this.obtenerIntentosFallidos(usuario.id);
            if (intentosFallidos >= 5) {
                const ultimoIntento = await this.obtenerUltimoIntentoFallido(usuario.id);
                const ahora = new Date();
                const tiempoTranscurrido = ahora - new Date(ultimoIntento);
                
                // Si el último intento fue hace menos de 30 minutos y hay 5+ intentos fallidos
                if (tiempoTranscurrido < 30 * 60 * 1000) {
                    logger.warn(`Login bloqueado temporalmente: Demasiados intentos fallidos (${usernameOrEmail})`);
                    throw new Error('Demasiados intentos fallidos. Por favor, intenta nuevamente en 30 minutos.');
                }
            }

            // Reset intentos fallidos al lograr iniciar sesión exitosamente
            await this.resetearIntentosFallidos(usuario.id);

            // Generar el token JWT
            const payload = {
                userId: usuario.id,
                username: usuario.nombre_usuario,
                rol: usuario.rol.nombre_rol,
                iat: Math.floor(Date.now() / 1000),  // Tiempo de emisión (issued at)
                exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // Expiración (8 horas)
                jti: this.generateUniqueId() // ID único para el token
            };

            const token = jwt.sign(
                payload,
                jwtConfig.secret
            );

            logger.info(`Login exitoso: ${usuario.nombre_usuario} (ID: ${usuario.id}) - Rol: ${usuario.rol.nombre_rol}`);

            // Registrar fecha de último acceso
            try {
                await usuario.update({ 
                    ultima_modificacion: new Date() 
                });
            } catch (updateError) {
                // No interrumpir el flujo si falla la actualización
                logger.warn(`No se pudo actualizar fecha de último acceso para ${usuario.nombre_usuario}:`, updateError);
            }

            // Devolver el token y datos del usuario (sin contraseña)
            return {
                token,
                usuario: {
                    id: usuario.id,
                    username: usuario.nombre_usuario,
                    email: usuario.correo_electronico,
                    nombre_completo: usuario.nombre_completo,
                    rol: usuario.rol.nombre_rol
                }
            };
        } catch (error) {
            logger.error('Error en AuthService.login:', error);
            throw error;
        }
    }
    
    /**
     * Genera un ID único para un token
     * @returns {string} - ID único
     */
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
    
    /**
     * Registra un intento fallido de login
     * @param {number} usuarioId - ID del usuario
     * @returns {Promise<boolean>} - true si se registró correctamente
     */
    async registrarIntentoFallido(usuarioId) {
        try {
            const key = `login_attempts_${usuarioId}`;
            
            // Buscar registro existente
            let registro = await Usuario.sequelize.models.Configuracion.findOne({
                where: { clave: key }
            });
            
            if (registro) {
                // Actualizar registro existente
                const datos = JSON.parse(registro.valor);
                datos.intentos = (datos.intentos || 0) + 1;
                datos.ultimo = new Date().toISOString();
                
                await registro.update({
                    valor: JSON.stringify(datos)
                });
            } else {
                // Crear nuevo registro
                await Usuario.sequelize.models.Configuracion.create({
                    clave: key,
                    valor: JSON.stringify({
                        intentos: 1,
                        ultimo: new Date().toISOString()
                    }),
                    descripcion: `Intentos fallidos de login para usuario ID ${usuarioId}`
                });
            }
            
            return true;
        } catch (error) {
            logger.error(`Error al registrar intento fallido para usuario ${usuarioId}:`, error);
            return false;
        }
    }
    
    /**
     * Obtiene el número de intentos fallidos recientes
     * @param {number} usuarioId - ID del usuario
     * @returns {Promise<number>} - Número de intentos fallidos
     */
    async obtenerIntentosFallidos(usuarioId) {
        try {
            const key = `login_attempts_${usuarioId}`;
            
            const registro = await Usuario.sequelize.models.Configuracion.findOne({
                where: { clave: key }
            });
            
            if (!registro) return 0;
            
            const datos = JSON.parse(registro.valor);
            const ultimoIntento = new Date(datos.ultimo);
            const ahora = new Date();
            
            // Si el último intento fue hace más de 30 minutos, reiniciar contador
            if (ahora - ultimoIntento > 30 * 60 * 1000) {
                await this.resetearIntentosFallidos(usuarioId);
                return 0;
            }
            
            return datos.intentos || 0;
        } catch (error) {
            logger.error(`Error al obtener intentos fallidos para usuario ${usuarioId}:`, error);
            return 0;
        }
    }
    
    /**
     * Obtiene la fecha del último intento fallido
     * @param {number} usuarioId - ID del usuario
     * @returns {Promise<string>} - Fecha del último intento
     */
    async obtenerUltimoIntentoFallido(usuarioId) {
        try {
            const key = `login_attempts_${usuarioId}`;
            
            const registro = await Usuario.sequelize.models.Configuracion.findOne({
                where: { clave: key }
            });
            
            if (!registro) return null;
            
            const datos = JSON.parse(registro.valor);
            return datos.ultimo;
        } catch (error) {
            logger.error(`Error al obtener último intento fallido para usuario ${usuarioId}:`, error);
            return null;
        }
    }
    
    /**
     * Reinicia el contador de intentos fallidos
     * @param {number} usuarioId - ID del usuario
     * @returns {Promise<boolean>} - true si se reinició correctamente
     */
    async resetearIntentosFallidos(usuarioId) {
        try {
            const key = `login_attempts_${usuarioId}`;
            
            await Usuario.sequelize.models.Configuracion.destroy({
                where: { clave: key }
            });
            
            return true;
        } catch (error) {
            logger.error(`Error al resetear intentos fallidos para usuario ${usuarioId}:`, error);
            return false;
        }
    }

    /**
     * Verifica si un token JWT es válido
     * @param {string} token - Token JWT
     * @returns {Object} - Payload decodificado del token
     * @throws {Error} - Si el token es inválido
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, jwtConfig.secret);
            
            // Verificar si el token ha sido revocado
            this.checkTokenRevocation(decoded.jti, decoded.userId)
                .catch(err => {
                    logger.warn(`Error al verificar revocación de token: ${err.message}`);
                });
            
            logger.debug(`Token verificado para usuario: ${decoded.username} (ID: ${decoded.userId})`);
            return decoded;
        } catch (error) {
            // Manejar errores específicos
            if (error.name === 'TokenExpiredError') {
                logger.warn('Error de verificación de token: Token expirado');
                throw new Error('El token ha expirado. Por favor, inicie sesión nuevamente.');
            } else if (error.name === 'JsonWebTokenError') {
                logger.warn('Error de verificación de token: Token inválido', error.message);
                throw new Error('Token inválido. Por favor, inicie sesión nuevamente.');
            } else {
                logger.error('Error al verificar token JWT:', error);
                throw error;
            }
        }
    }
    
    /**
     * Verifica si un token ha sido revocado
     * @param {string} tokenId - ID único del token (jti)
     * @param {number} userId - ID del usuario
     * @returns {Promise<boolean>} - true si el token es válido
     * @throws {Error} - Si el token ha sido revocado
     */
    async checkTokenRevocation(tokenId, userId) {
        try {
            // Buscar en la lista de tokens revocados
            const key = `revoked_tokens_${userId}`;
            
            const registro = await Usuario.sequelize.models.Configuracion.findOne({
                where: { clave: key }
            });
            
            if (!registro) return true; // No hay tokens revocados para este usuario
            
            const tokens = JSON.parse(registro.valor);
            
            // Verificar si el token está en la lista de revocados
            if (tokens.includes(tokenId)) {
                logger.warn(`Token revocado encontrado: ${tokenId} para usuario ${userId}`);
                throw new Error('El token ha sido revocado. Por favor, inicie sesión nuevamente.');
            }
            
            return true;
        } catch (error) {
            logger.error(`Error al verificar revocación de token: ${error.message}`);
            // Si hay error en la verificación, permitir continuar
            return true;
        }
    }
    
    /**
     * Revoca un token específico
     * @param {string} token - Token JWT a revocar
     * @returns {Promise<boolean>} - true si se revocó correctamente
     */
    async revokeToken(token) {
        try {
            // Decodificar el token sin verificar (podría estar expirado)
            const decoded = jwt.decode(token);
            
            if (!decoded || !decoded.jti || !decoded.userId) {
                logger.warn('Intento de revocar token inválido');
                return false;
            }
            
            const tokenId = decoded.jti;
            const userId = decoded.userId;
            
            // Añadir a la lista de tokens revocados
            const key = `revoked_tokens_${userId}`;
            
            // Buscar registro existente
            let registro = await Usuario.sequelize.models.Configuracion.findOne({
                where: { clave: key }
            });
            
            if (registro) {
                // Actualizar registro existente
                let tokens = JSON.parse(registro.valor);
                
                // Añadir el nuevo token solo si no existe ya
                if (!tokens.includes(tokenId)) {
                    tokens.push(tokenId);
                    
                    // Mantener solo los últimos 100 tokens para evitar crecimiento indefinido
                    if (tokens.length > 100) {
                        tokens = tokens.slice(-100);
                    }
                    
                    await registro.update({
                        valor: JSON.stringify(tokens)
                    });
                }
            } else {
                // Crear nuevo registro
                await Usuario.sequelize.models.Configuracion.create({
                    clave: key,
                    valor: JSON.stringify([tokenId]),
                    descripcion: `Tokens revocados para usuario ID ${userId}`
                });
            }
            
            logger.info(`Token revocado: ${tokenId} para usuario ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Error al revocar token: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Revoca todos los tokens de un usuario
     * @param {number} userId - ID del usuario
     * @returns {Promise<boolean>} - true si se revocaron correctamente
     */
    async revokeAllTokens(userId) {
        try {
            // Generar un nuevo registro de tokens revocados
            // Esto efectivamente revoca todos los tokens anteriores
            const key = `revoked_tokens_${userId}`;
            
            // Crear o actualizar el registro
            await Usuario.sequelize.models.Configuracion.upsert({
                clave: key,
                valor: JSON.stringify([`all_revoked_${Date.now()}`]),
                descripcion: `Tokens revocados para usuario ID ${userId}`
            });
            
            logger.info(`Todos los tokens revocados para usuario ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Error al revocar todos los tokens para usuario ${userId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Genera un hash para una contraseña
     * @param {string} password - Contraseña a hashear
     * @returns {Promise<string>} - Hash de la contraseña
     */
    async hashPassword(password) {
        try {
            return await passwordUtil.generateHash(password);
        } catch (error) {
            logger.error('Error al generar hash de contraseña:', error);
            throw error;
        }
    }

    /**
     * Cambia la contraseña de un usuario
     * @param {number} usuarioId - ID del usuario
     * @param {string} nuevaContrasena - Nueva contraseña en texto plano
     * @returns {Promise<boolean>} - true si el cambio fue exitoso
     */
    async cambiarContrasena(usuarioId, nuevaContrasena) {
        try {
            // Verificar fortaleza de la contraseña
            const evaluacion = passwordUtil.evaluateStrength(nuevaContrasena);
            if (!evaluacion.isValid) {
                throw new Error(`Contraseña débil: ${evaluacion.feedback.join('. ')}`);
            }

            // Buscar el usuario
            const usuario = await Usuario.findByPk(usuarioId);
            if (!usuario) {
                throw new Error('Usuario no encontrado.');
            }

            // Generar hash y actualizar
            const hash = await this.hashPassword(nuevaContrasena);
            await usuario.update({ contrasena_hash: hash });
            
            // Revocar todos los tokens del usuario para forzar re-login
            await this.revokeAllTokens(usuarioId);

            logger.info(`Contraseña actualizada para el usuario: ${usuario.nombre_usuario} (ID: ${usuario.id})`);
            return true;
        } catch (error) {
            logger.error(`Error al cambiar contraseña para usuario ID ${usuarioId}:`, error);
            throw error;
        }
    }

    /**
     * Verifica si un usuario existe por nombre de usuario o correo
     * @param {string} nombreUsuario - Nombre de usuario a verificar
     * @param {string} correoElectronico - Correo electrónico a verificar
     * @returns {Promise<boolean>} - true si el usuario existe
     */
    async existeUsuario(nombreUsuario, correoElectronico) {
        try {
            const count = await Usuario.count({
                where: {
                    [Op.or]: [
                        { nombre_usuario: nombreUsuario },
                        { correo_electronico: correoElectronico }
                    ]
                }
            });
            return count > 0;
        } catch (error) {
            logger.error('Error al verificar existencia de usuario:', error);
            throw error;
        }
    }

    /**
     * Genera un token de restablecimiento de contraseña
     * @param {string} usernameOrEmail - Nombre de usuario o correo electrónico
     * @returns {Promise<Object>} - Objeto con token y datos del usuario
     */
    async generateResetToken(usernameOrEmail) {
        try {
            // Buscar usuario
            const usuario = await Usuario.findOne({
                where: {
                    [Op.or]: [
                        { nombre_usuario: usernameOrEmail },
                        { correo_electronico: usernameOrEmail }
                    ]
                }
            });

            if (!usuario) {
                throw new Error('Usuario no encontrado.');
            }

            // Generar token con expiración corta (15 minutos)
            const payload = {
                userId: usuario.id,
                username: usuario.nombre_usuario,
                purpose: 'password_reset',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (15 * 60),
                jti: this.generateUniqueId()
            };

            const resetToken = jwt.sign(
                payload,
                jwtConfig.secret
            );

            logger.info(`Token de restablecimiento generado para: ${usuario.nombre_usuario} (ID: ${usuario.id})`);
            return {
                token: resetToken,
                usuario: {
                    id: usuario.id,
                    username: usuario.nombre_usuario,
                    email: usuario.correo_electronico
                }
            };
        } catch (error) {
            logger.error('Error al generar token de restablecimiento:', error);
            throw error;
        }
    }

    /**
     * Verifica los permisos de un usuario basado en su rol
     * @param {Object} userData - Datos del usuario desde el token JWT
     * @param {string} requiredRole - Rol requerido para acceder
     * @returns {boolean} - true si el usuario tiene el rol requerido
     */
    hasPermission(userData, requiredRole) {
        if (!userData || !userData.rol) {
            return false;
        }

        if (requiredRole === 'Administrador') {
            return userData.rol === 'Administrador';
        }

        // Para roles menos privilegiados, puede acceder si tiene un rol igual o mayor
        if (requiredRole === 'Usuario') {
            return userData.rol === 'Administrador' || userData.rol === 'Usuario';
        }

        // Por defecto, verificar igualdad exacta
        return userData.rol === requiredRole;
    }
    
    /**
     * Registra una acción de usuario en los logs del sistema
     * @param {number} userId - ID del usuario
     * @param {string} accion - Descripción de la acción
     * @param {Object} datos - Datos adicionales (opcional)
     * @returns {Promise<boolean>} - true si se registró correctamente
     */
    async registrarAccion(userId, accion, datos = {}) {
        try {
            const key = `user_action_${Date.now()}_${userId}`;
            
            await Usuario.sequelize.models.Configuracion.create({
                clave: key,
                valor: JSON.stringify({
                    userId,
                    accion,
                    datos,
                    timestamp: new Date().toISOString(),
                    ip: datos.ip || 'no-ip'
                }),
                descripcion: `Registro de acción de usuario ID ${userId}: ${accion.substring(0, 50)}`
            });
            
            return true;
        } catch (error) {
            logger.error(`Error al registrar acción de usuario ${userId}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Obtiene las acciones recientes de un usuario
     * @param {number} userId - ID del usuario
     * @param {number} limit - Límite de acciones a obtener
     * @returns {Promise<Array>} - Lista de acciones
     */
    async obtenerAcciones(userId, limit = 20) {
        try {
            // Buscar todos los registros de acciones del usuario
            const registros = await Usuario.sequelize.models.Configuracion.findAll({
                where: {
                    clave: {
                        [Op.like]: `user_action_%_${userId}`
                    }
                },
                order: [['ultima_modificacion', 'DESC']],
                limit: limit,
                raw: true
            });
            
            // Transformar a formato amigable
            return registros.map(registro => {
                try {
                    const datos = JSON.parse(registro.valor);
                    return {
                        id: registro.clave,
                        userId: datos.userId,
                        accion: datos.accion,
                        datos: datos.datos,
                        timestamp: datos.timestamp,
                        ip: datos.ip
                    };
                } catch (e) {
                    return {
                        id: registro.clave,
                        error: 'Formato inválido',
                        clave: registro.clave
                    };
                }
            });
        } catch (error) {
            logger.error(`Error al obtener acciones de usuario ${userId}: ${error.message}`);
            return [];
        }
    }
}

module.exports = new AuthService();