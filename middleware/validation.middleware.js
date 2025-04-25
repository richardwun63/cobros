// middleware/validation.middleware.js
/**
 * Custom validation middleware for request data
 * Proporciona funciones para validar datos de entrada
 */

const logger = require('../utils/logger.util');

console.log(' Mdl Cargando middleware de validación...');

// Función para verificar errores de validación
const validarResultados = (req, res, next) => {
    // Si no existe el array de errores, crearlo
    if (!req.validationErrors) {
        req.validationErrors = [];
    }
    
    const errores = req.validationErrors;
    if (errores.length > 0) {
        logger.warn('Errores de validación detectados:', { errors: errores.map(e => e.msg) });
        return res.status(400).json({ 
            message: 'Datos inválidos en la petición.', 
            errors: errores 
        });
    }
    next();
};

// Función auxiliar para validar campos según reglas
const validarCampo = (value, rules, fieldName) => {
    const errors = [];
    
    // Validación de campo requerido
    if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({
            msg: `El campo ${fieldName} es requerido`,
            param: fieldName
        });
    }
    
    // Si el campo es requerido y no está presente, no seguir validando
    if (rules.required && (value === undefined || value === null || value === '')) {
        return errors;
    }
    
    // Validación de longitud mínima
    if (rules.minLength && value && value.length < rules.minLength) {
        errors.push({
            msg: `El campo ${fieldName} debe tener al menos ${rules.minLength} caracteres`,
            param: fieldName
        });
    }
    
    // Validación de longitud máxima
    if (rules.maxLength && value && value.length > rules.maxLength) {
        errors.push({
            msg: `El campo ${fieldName} no debe exceder los ${rules.maxLength} caracteres`,
            param: fieldName
        });
    }
    
    // Validación de email
    if (rules.isEmail && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            errors.push({
                msg: `${fieldName} debe ser un correo electrónico válido`,
                param: fieldName
            });
        }
    }
    
    // Validación de valor numérico
    if (rules.isNumeric && value !== undefined && value !== null && value !== '') {
        if (isNaN(Number(value))) {
            errors.push({
                msg: `${fieldName} debe ser un valor numérico`,
                param: fieldName
            });
        }
    }
    
    // Validación de valor mínimo
    if (rules.min !== undefined && value !== undefined && value !== null && value !== '') {
        const numValue = Number(value);
        if (!isNaN(numValue) && numValue < rules.min) {
            errors.push({
                msg: `${fieldName} debe ser al menos ${rules.min}`,
                param: fieldName
            });
        }
    }
    
    // Validación de valor máximo
    if (rules.max !== undefined && value !== undefined && value !== null && value !== '') {
        const numValue = Number(value);
        if (!isNaN(numValue) && numValue > rules.max) {
            errors.push({
                msg: `${fieldName} debe ser como máximo ${rules.max}`,
                param: fieldName
            });
        }
    }
    
    // Validación de formato de fecha
    if (rules.isDate && value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // Formato YYYY-MM-DD
        if (!dateRegex.test(value) || isNaN(Date.parse(value))) {
            errors.push({
                msg: `${fieldName} debe ser una fecha válida en formato YYYY-MM-DD`,
                param: fieldName
            });
        }
    }
    
    // Validación con expresión regular
    if (rules.regex && value) {
        const regex = new RegExp(rules.regex);
        if (!regex.test(value)) {
            errors.push({
                msg: rules.regexMessage || `${fieldName} tiene un formato inválido`,
                param: fieldName
            });
        }
    }
    
    // Validación de valor en lista de opciones
    if (rules.isIn && value) {
        if (!rules.isIn.includes(value)) {
            errors.push({
                msg: `${fieldName} debe ser uno de los siguientes valores: ${rules.isIn.join(', ')}`,
                param: fieldName
            });
        }
    }
    
    // Validación personalizada
    if (rules.custom && typeof rules.custom === 'function') {
        const customError = rules.custom(value);
        if (customError) {
            errors.push({
                msg: customError,
                param: fieldName
            });
        }
    }
    
    return errors;
};

// Middleware de validación para Usuario
const validarCreacionUsuario = (req, res, next) => {
    req.validationErrors = [];
    
    // Validar campos requeridos
    const { nombre_usuario, correo_electronico, contrasena_hash, rol_id } = req.body;
    
    // Validación de nombre de usuario
    req.validationErrors.push(...validarCampo(nombre_usuario, {
        required: true,
        minLength: 3,
        maxLength: 50,
        regex: /^[a-zA-Z0-9_]+$/,
        regexMessage: 'El nombre de usuario solo puede contener letras, números y guiones bajos'
    }, 'nombre_usuario'));
    
    // Validación de correo electrónico
    req.validationErrors.push(...validarCampo(correo_electronico, {
        required: true,
        isEmail: true,
        maxLength: 255
    }, 'correo_electronico'));
    
    // Validación de contraseña
    req.validationErrors.push(...validarCampo(contrasena_hash, {
        required: true,
        minLength: 6
    }, 'contrasena_hash'));
    
    // Validación de rol
    req.validationErrors.push(...validarCampo(rol_id, {
        required: true,
        isNumeric: true,
        min: 1
    }, 'rol_id'));
    
    // Validar nombre completo si existe
    if (req.body.nombre_completo) {
        req.validationErrors.push(...validarCampo(req.body.nombre_completo, {
            maxLength: 200
        }, 'nombre_completo'));
    }
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para actualización de Usuario
const validarActualizacionUsuario = (req, res, next) => {
    req.validationErrors = [];
    
    const { nombre_usuario, correo_electronico, rol_id } = req.body;
    
    // Validación de nombre de usuario si está presente
    if (nombre_usuario !== undefined) {
        req.validationErrors.push(...validarCampo(nombre_usuario, {
            required: true,
            minLength: 3,
            maxLength: 50,
            regex: /^[a-zA-Z0-9_]+$/,
            regexMessage: 'El nombre de usuario solo puede contener letras, números y guiones bajos'
        }, 'nombre_usuario'));
    }
    
    // Validación de correo electrónico si está presente
    if (correo_electronico !== undefined) {
        req.validationErrors.push(...validarCampo(correo_electronico, {
            required: true,
            isEmail: true,
            maxLength: 255
        }, 'correo_electronico'));
    }
    
    // Validación de rol si está presente
    if (rol_id !== undefined) {
        req.validationErrors.push(...validarCampo(rol_id, {
            required: true,
            isNumeric: true,
            min: 1
        }, 'rol_id'));
    }
    
    // Validar nombre completo si existe
    if (req.body.nombre_completo !== undefined) {
        req.validationErrors.push(...validarCampo(req.body.nombre_completo, {
            maxLength: 200
        }, 'nombre_completo'));
    }
    
    // No permitir actualización de contraseña por esta ruta
    if (req.body.contrasena_hash || req.body.password) {
        req.validationErrors.push({
            msg: 'Para actualizar la contraseña, use la ruta específica PATCH /api/usuarios/:id/contrasena',
            param: 'contrasena_hash'
        });
    }
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para cambio de contraseña
const validarCambioContrasena = (req, res, next) => {
    req.validationErrors = [];
    
    const { nuevaContrasena } = req.body;
    
    // Validación de nueva contraseña
    req.validationErrors.push(...validarCampo(nuevaContrasena, {
        required: true,
        minLength: 6
    }, 'nuevaContrasena'));
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para cambio de estado de usuario
const validarCambioEstadoUsuario = (req, res, next) => {
    req.validationErrors = [];
    
    const { activo } = req.body;
    
    // Validación de estado activo
    req.validationErrors.push(...validarCampo(activo, {
        required: true,
        custom: (value) => {
            if (typeof value !== 'boolean') {
                return 'El campo activo debe ser verdadero o falso';
            }
            return null;
        }
    }, 'activo'));
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para Cliente
const validarCreacionCliente = (req, res, next) => {
    req.validationErrors = [];
    
    const { nombre_cliente, ruc_dni, correo_electronico, telefono, estado_cliente, direccion } = req.body;
    
    // Validación de nombre de cliente
    req.validationErrors.push(...validarCampo(nombre_cliente, {
        required: true,
        maxLength: 255
    }, 'nombre_cliente'));
    
    // Validación de RUC/DNI si está presente
    if (ruc_dni !== undefined) {
        req.validationErrors.push(...validarCampo(ruc_dni, {
            minLength: 8,
            maxLength: 20
        }, 'ruc_dni'));
    }
    
    // Validación de correo electrónico si está presente
    if (correo_electronico !== undefined) {
        req.validationErrors.push(...validarCampo(correo_electronico, {
            isEmail: true,
            maxLength: 255
        }, 'correo_electronico'));
    }
    
    // Validación de teléfono si está presente
    if (telefono !== undefined) {
        req.validationErrors.push(...validarCampo(telefono, {
            maxLength: 50
        }, 'telefono'));
    }
    
    // Validación de estado del cliente si está presente
    if (estado_cliente !== undefined) {
        req.validationErrors.push(...validarCampo(estado_cliente, {
            isIn: ['Activo', 'Inactivo', 'Pendiente', 'Atrasado']
        }, 'estado_cliente'));
    }
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para Cobro
const validarCreacionCobro = (req, res, next) => {
    req.validationErrors = [];
    
    const { cliente_id, monto, fecha_emision, fecha_vencimiento, estado_cobro, servicio_id } = req.body;
    
    // Validación de cliente
    req.validationErrors.push(...validarCampo(cliente_id, {
        required: true,
        isNumeric: true,
        min: 1
    }, 'cliente_id'));
    
    // Validación de monto
    req.validationErrors.push(...validarCampo(monto, {
        required: true,
        isNumeric: true,
        min: 0.01
    }, 'monto'));
    
    // Validación de fecha de emisión
    req.validationErrors.push(...validarCampo(fecha_emision, {
        required: true,
        isDate: true
    }, 'fecha_emision'));
    
    // Validación de fecha de vencimiento
    req.validationErrors.push(...validarCampo(fecha_vencimiento, {
        required: true,
        isDate: true,
        custom: (value) => {
            if (fecha_emision && new Date(value) < new Date(fecha_emision)) {
                return 'La fecha de vencimiento debe ser posterior a la fecha de emisión';
            }
            return null;
        }
    }, 'fecha_vencimiento'));
    
    // Validación de estado del cobro si está presente
    if (estado_cobro !== undefined) {
        req.validationErrors.push(...validarCampo(estado_cobro, {
            isIn: ['Pagado', 'Pendiente', 'Atrasado', 'Anulado']
        }, 'estado_cobro'));
    }
    
    // Validación de servicio si está presente
    if (servicio_id !== undefined) {
        req.validationErrors.push(...validarCampo(servicio_id, {
            isNumeric: true,
            min: 1
        }, 'servicio_id'));
    }
    
    // Si el estado es Pagado, debe tener fecha de pago
    if (estado_cobro === 'Pagado' && !req.body.fecha_pago) {
        req.body.fecha_pago = new Date().toISOString().substring(0, 10); // Fecha actual en formato YYYY-MM-DD
    }
    
    // Validación de fecha de pago si está presente
    if (req.body.fecha_pago !== undefined) {
        req.validationErrors.push(...validarCampo(req.body.fecha_pago, {
            isDate: true
        }, 'fecha_pago'));
    }
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para actualización de Cobro
const validarActualizacionCobro = (req, res, next) => {
    req.validationErrors = [];
    
    const { cliente_id, monto, fecha_emision, fecha_vencimiento, estado_cobro, servicio_id } = req.body;
    
    // Validación de cliente si está presente
    if (cliente_id !== undefined) {
        req.validationErrors.push(...validarCampo(cliente_id, {
            required: true,
            isNumeric: true,
            min: 1
        }, 'cliente_id'));
    }
    
    // Validación de monto si está presente
    if (monto !== undefined) {
        req.validationErrors.push(...validarCampo(monto, {
            required: true,
            isNumeric: true,
            min: 0.01
        }, 'monto'));
    }
    
    // Validación de fecha de emisión si está presente
    if (fecha_emision !== undefined) {
        req.validationErrors.push(...validarCampo(fecha_emision, {
            required: true,
            isDate: true
        }, 'fecha_emision'));
    }
    
    // Validación de fecha de vencimiento si está presente
    if (fecha_vencimiento !== undefined) {
        req.validationErrors.push(...validarCampo(fecha_vencimiento, {
            required: true,
            isDate: true,
            custom: (value) => {
                if (fecha_emision && new Date(value) < new Date(fecha_emision)) {
                    return 'La fecha de vencimiento debe ser posterior a la fecha de emisión';
                }
                return null;
            }
        }, 'fecha_vencimiento'));
    }
    
    // Validación de estado del cobro si está presente
    if (estado_cobro !== undefined) {
        req.validationErrors.push(...validarCampo(estado_cobro, {
            isIn: ['Pagado', 'Pendiente', 'Atrasado', 'Anulado']
        }, 'estado_cobro'));
        
        // Si se cambia a Pagado y no se especifica fecha_pago, establecer a hoy
        if (estado_cobro === 'Pagado' && req.body.fecha_pago === undefined) {
            req.body.fecha_pago = new Date().toISOString().substring(0, 10);
        }
    }
    
    // Validación de servicio si está presente
    if (servicio_id !== undefined) {
        req.validationErrors.push(...validarCampo(servicio_id, {
            isNumeric: true,
            min: 1
        }, 'servicio_id'));
    }
    
    // Validación de fecha de pago si está presente
    if (req.body.fecha_pago !== undefined) {
        req.validationErrors.push(...validarCampo(req.body.fecha_pago, {
            isDate: true
        }, 'fecha_pago'));
    }
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para Servicio
const validarCreacionServicio = (req, res, next) => {
    req.validationErrors = [];
    
    const { nombre_servicio, precio_base } = req.body;
    
    // Validación de nombre de servicio
    req.validationErrors.push(...validarCampo(nombre_servicio, {
        required: true,
        maxLength: 150
    }, 'nombre_servicio'));
    
    // Validación de precio base si está presente
    if (precio_base !== undefined) {
        req.validationErrors.push(...validarCampo(precio_base, {
            isNumeric: true,
            min: 0
        }, 'precio_base'));
    }
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para ID en parámetros
const validarId = (req, res, next) => {
    req.validationErrors = [];
    
    const id = req.params.id;
    
    // Validación de ID
    req.validationErrors.push(...validarCampo(id, {
        required: true,
        isNumeric: true,
        min: 1,
        custom: (value) => {
            if (!Number.isInteger(Number(value))) {
                return 'ID debe ser un número entero';
            }
            return null;
        }
    }, 'id'));
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para credenciales de WhatsApp
const validarCredencialesWhatsApp = (req, res, next) => {
    req.validationErrors = [];
    
    const { phoneNumberId, accessToken } = req.body;
    
    // Validación de phoneNumberId
    req.validationErrors.push(...validarCampo(phoneNumberId, {
        required: true,
        minLength: 5
    }, 'phoneNumberId'));
    
    // Validación de accessToken
    req.validationErrors.push(...validarCampo(accessToken, {
        required: true,
        minLength: 10
    }, 'accessToken'));
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

// Middleware de validación para notificación WhatsApp
const validarNotificacionWhatsApp = (req, res, next) => {
    req.validationErrors = [];
    
    const { clienteId, mensaje } = req.body;
    
    // Validación de clienteId
    req.validationErrors.push(...validarCampo(clienteId, {
        required: true,
        isNumeric: true,
        min: 1
    }, 'clienteId'));
    
    // Validación de mensaje
    req.validationErrors.push(...validarCampo(mensaje, {
        required: true,
        minLength: 5,
        maxLength: 1000
    }, 'mensaje'));
    
    // Continuar con la validación de resultados
    return validarResultados(req, res, next);
};

module.exports = {
    validarResultados,
    validarCampo,
    validarCreacionUsuario,
    validarActualizacionUsuario,
    validarCambioContrasena,
    validarCambioEstadoUsuario,
    validarCreacionCliente,
    validarCreacionCobro,
    validarActualizacionCobro,
    validarCreacionServicio,
    validarId,
    validarCredencialesWhatsApp,
    validarNotificacionWhatsApp
};

console.log(' Mdl Middleware de validación cargado.');