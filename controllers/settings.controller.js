// controllers/settings.controller.js
const { Configuracion } = require('../models');
const { sequelize } = require('../config/database');
const databaseService = require('../services/database.service');
const whatsappService = require('../services/whatsapp.service');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger.util');

console.log(' C Cargando controlador de Settings...');

// --- Obtener Configuraciones ---
const obtenerConfiguraciones = async (req, res, next) => {
  console.log(' C Controlador: Petición GET a /api/settings recibida.');
  try {
    // Intentar obtener todas las configuraciones de la BD
    const configuraciones = await Configuracion.findAll({ 
      attributes: ['clave', 'valor', 'descripcion'],
      raw: true 
    });

    // Convertir el array de objetos [{clave: k, valor: v}, ...] a un objeto { k1: v1, k2: v2 }
    const settingsObj = configuraciones.reduce((acc, curr) => {
      // Excluir configuraciones relacionadas con credenciales de seguridad o tokens
      if (!curr.clave.includes('token') && !curr.clave.includes('password') && 
          !curr.clave.includes('secret') && !curr.clave.includes('key')) {
        acc[curr.clave] = curr.valor;
      }
      return acc;
    }, {});

    console.log(' C Configuraciones obtenidas:', Object.keys(settingsObj).length);
    res.status(200).json(settingsObj);

  } catch (error) {
     if (error.name === 'SequelizeDatabaseError' && error.original && 
         (error.original.code === 'ER_NO_SUCH_TABLE' || error.message.includes('configuraciones" doesn\'t exist'))) {
         console.warn(' C Advertencia: La tabla "configuraciones" no existe. Intentando crearla...');
         
         try {
           await sequelize.query(`
             CREATE TABLE IF NOT EXISTS configuraciones (
               clave VARCHAR(100) PRIMARY KEY,
               valor TEXT,
               descripcion VARCHAR(255),
               ultima_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
             ) ENGINE=InnoDB COMMENT='Almacena configuraciones generales del sistema';
           `);
           console.log(' C Tabla configuraciones creada automáticamente.');
           return res.status(200).json({}); // Devuelve objeto vacío tras crear la tabla
         } catch (createError) {
           console.error(' C Error al intentar crear la tabla configuraciones:', createError);
           return res.status(500).json({ message: 'Error interno: No se pudo crear la tabla de configuraciones.' });
         }
     }
    console.error(' C Error al obtener configuraciones:', error);
    next(error);
  }
};

// --- Actualizar Configuraciones ---
const actualizarConfiguraciones = async (req, res, next) => {
  // Se espera recibir un objeto con pares clave-valor en el body
  const nuevasConfiguraciones = req.body;
  console.log(' C Controlador: Petición PUT a /api/settings recibida. Datos:', 
    Object.keys(nuevasConfiguraciones).length, 'configuraciones');

  if (typeof nuevasConfiguraciones !== 'object' || nuevasConfiguraciones === null) {
      return res.status(400).json({ message: 'El cuerpo de la petición debe ser un objeto JSON con las configuraciones.' });
  }

  const claves = Object.keys(nuevasConfiguraciones);
  if (claves.length === 0) {
      return res.status(400).json({ message: 'No se proporcionaron configuraciones para actualizar.' });
  }

  // Usar una transacción para asegurar que todas las actualizaciones se hagan o ninguna
  let t;
  try {
    t = await sequelize.transaction(); // Inicia transacción

    // Iterar sobre cada clave-valor recibido y hacer un 'upsert'
    // 'upsert' intentará actualizar si la clave existe, o insertar si no existe.
    const promesasUpsert = claves.map(clave => {
      const valor = nuevasConfiguraciones[clave];
      console.log(` C Procesando upsert para clave: ${clave}`);
      
      return Configuracion.upsert(
        { 
          clave: clave, 
          valor: valor,
          descripcion: `Configuración actualizada desde el panel de control el ${new Date().toLocaleString()}`
        },
        { transaction: t } // Ejecutar dentro de la transacción
      );
    });

    // Esperar a que todas las operaciones de upsert terminen
    await Promise.all(promesasUpsert);

    // Si todo fue bien, confirmar la transacción
    await t.commit();
    console.log(' C Configuraciones actualizadas/insertadas exitosamente.');

    // Devolver un mensaje de éxito o las configuraciones actualizadas
    const configActualizadas = await Configuracion.findAll({ 
      where: { clave: claves }, 
      attributes: ['clave', 'valor'],
      raw: true 
    });
    
    const settingsObj = configActualizadas.reduce((acc, curr) => {
      if (!curr.clave.includes('token') && !curr.clave.includes('password') && 
          !curr.clave.includes('secret') && !curr.clave.includes('key')) {
        acc[curr.clave] = curr.valor;
      }
      return acc;
    }, {});

    res.status(200).json({ 
      message: 'Configuraciones actualizadas.', 
      settings: settingsObj 
    });

  } catch (error) {
    // Si hubo algún error, revertir la transacción si está inicializada
    if (t) await t.rollback();
    
    if (error.name === 'SequelizeDatabaseError' && error.original && 
        (error.original.code === 'ER_NO_SUCH_TABLE' || error.message.includes('configuraciones" doesn\'t exist'))) {
      console.error(' C Error: La tabla "configuraciones" no existe para actualizar.');
      
      // Intentar crear la tabla automáticamente
      try {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS configuraciones (
            clave VARCHAR(100) PRIMARY KEY,
            valor TEXT,
            descripcion VARCHAR(255),
            ultima_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB COMMENT='Almacena configuraciones generales del sistema';
        `);
        console.log(' C Tabla configuraciones creada automáticamente. Reintentando operación...');
        return actualizarConfiguraciones(req, res, next); // Reintentar la operación
      } catch (createError) {
        console.error(' C Error al intentar crear la tabla configuraciones:', createError);
        return res.status(500).json({ message: 'Error interno: No se pudo crear la tabla de configuraciones.' });
      }
    }
    console.error(' C Error al actualizar configuraciones:', error);
    next(error);
  }
};


// --- Funciones de WhatsApp ---

const obtenerEstadoWhatsApp = async (req, res) => {
    console.log(' C Controlador: Petición GET a /api/settings/whatsapp/status');
    try {
        // Obtener estado actual de WhatsApp
        const estado = await whatsappService.getStatus();
        
        // Obtener configuraciones adicionales para la edición
        let phoneId = null;
        let apiUrl = null;
        
        try {
            const phoneIdConfig = await Configuracion.findOne({ 
                where: { clave: 'whatsapp_phone_id' }, 
                raw: true 
            });
            
            const apiUrlConfig = await Configuracion.findOne({ 
                where: { clave: 'whatsapp_api_url' },
                raw: true
            });
            
            if (phoneIdConfig) {
                phoneId = phoneIdConfig.valor;
            }
            
            if (apiUrlConfig) {
                apiUrl = apiUrlConfig.valor;
            }
        } catch (configError) {
            console.warn(' C Advertencia: No se pudieron cargar las configuraciones adicionales de WhatsApp', configError);
        }
        
        res.status(200).json({
            status: estado.status,
            number: estado.number || '',
            lastConnection: estado.lastConnection || null,
            phoneId: phoneId,
            apiUrl: apiUrl,
            message: estado.status === 'connected' ? 
                    'WhatsApp conectado correctamente.' : 
                    'WhatsApp desconectado.'
        });
    } catch (error) {
        console.error(' C Error al obtener estado de WhatsApp:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error al obtener el estado de WhatsApp: ' + error.message
        });
    }
};

const conectarWhatsAppAPI = async (req, res) => {
    console.log(' C Controlador: Petición POST a /api/settings/whatsapp/connect');
    try {
        // Si se proporcionaron credenciales en el cuerpo de la solicitud, guardarlas primero
        if (req.body && (req.body.phoneNumberId || req.body.accessToken)) {
            await whatsappService.saveCredentials({
                phoneNumberId: req.body.phoneNumberId,
                accessToken: req.body.accessToken,
                apiUrl: req.body.apiUrl
            });
            console.log(' C Credenciales de WhatsApp actualizadas');
        }
        
        // Intentar conectar con la API de WhatsApp
        const resultado = await whatsappService.connect();
        
        res.status(200).json({ 
            message: 'Conexión con WhatsApp iniciada exitosamente.',
            status: resultado.status,
            number: resultado.verifiedName
        });
    } catch (error) {
        console.error(' C Error al conectar WhatsApp:', error);
        res.status(500).json({ 
            message: 'Error al iniciar conexión con WhatsApp: ' + error.message,
            error: error.message
        });
    }
};

const desconectarWhatsApp = async (req, res) => {
    console.log(' C Controlador: Petición POST a /api/settings/whatsapp/disconnect');
    try {
        // Desconectar WhatsApp
        const resultado = await whatsappService.disconnect();
        
        res.status(200).json({ 
            message: 'Desconexión de WhatsApp realizada exitosamente.',
            status: resultado.status
        });
    } catch (error) {
        console.error(' C Error al desconectar WhatsApp:', error);
        res.status(500).json({ 
            message: 'Error al desconectar WhatsApp: ' + error.message,
            error: error.message 
        });
    }
};

// --- Funciones de Backup ---

const crearBackup = async (req, res) => {
    console.log(' C Controlador: Petición POST a /api/settings/backup/create');
    try {
        // Utilizar el servicio de base de datos para crear el backup
        const backupInfo = await databaseService.createBackup();
        
        // Guardar registro del backup exitoso
        await Configuracion.upsert({ 
            clave: `backup_${backupInfo.id}`, 
            valor: JSON.stringify(backupInfo),
            descripcion: 'Registro de respaldo de base de datos'
        });
        
        console.log(` C Backup creado exitosamente: ${backupInfo.ruta}`);
        res.status(200).json({ 
            message: 'Respaldo creado exitosamente.',
            backup: {
                id: backupInfo.id,
                fecha: backupInfo.fecha,
                tamanio: backupInfo.tamanio
            }
        });
    } catch (error) {
        console.error(' C Error al crear backup:', error);
        res.status(500).json({ 
            message: 'Error al crear respaldo de la base de datos: ' + error.message,
            error: error.message
        });
    }
};

const listarBackups = async (req, res) => {
    console.log(' C Controlador: Petición GET a /api/settings/backups');
    try {
        // Obtener todos los registros de backups guardados en configuraciones
        const backupConfigs = await Configuracion.findAll({
            where: sequelize.where(
                sequelize.fn('substring', sequelize.col('clave'), 1, 7),
                'backup_'
            ),
            order: [['ultima_modificacion', 'DESC']], // Más recientes primero
            raw: true
        });
        
        // Transformar a formato más amigable
        const backups = backupConfigs.map(config => {
            try {
                // Cada backup está guardado como JSON string
                const backupData = JSON.parse(config.valor);
                return {
                    id: config.clave.replace('backup_', ''),
                    fecha: backupData.fecha,
                    nombre: backupData.nombre,
                    tamanio: backupData.tamanio,
                    ruta: backupData.ruta
                };
            } catch (e) {
                // Si hay error al parsear, retornar info básica
                return {
                    id: config.clave.replace('backup_', ''),
                    fecha: config.ultima_modificacion,
                    nombre: config.clave,
                    tamanio: 'Desconocido',
                    error: 'Formato inválido'
                };
            }
        });
        
        res.status(200).json({ backups });
    } catch (error) {
        console.error(' C Error al listar backups:', error);
        res.status(500).json({ 
            message: 'Error al obtener lista de respaldos: ' + error.message,
            error: error.message
        });
    }
};

const restaurarBackup = async (req, res) => {
    const backupId = req.params.id;
    console.log(` C Controlador: Petición POST a /api/settings/backups/${backupId}/restore`);
    
    try {
        // Buscar el registro del backup
        const clave = `backup_${backupId}`;
        const backupConfig = await Configuracion.findOne({
            where: { clave },
            raw: true
        });
        
        if (!backupConfig) {
            return res.status(404).json({ message: 'Respaldo no encontrado.' });
        }
        
        // Obtener la ruta del archivo de backup
        const backupData = JSON.parse(backupConfig.valor);
        if (!backupData.ruta || !(await fileExists(backupData.ruta))) {
            return res.status(404).json({ message: 'Archivo de respaldo no encontrado.' });
        }
        
        // Restaurar desde la ruta
        await databaseService.restoreBackup(backupData.ruta);
        
        res.status(200).json({ 
            message: 'Respaldo restaurado correctamente.',
            backupId: backupId
        });
    } catch (error) {
        console.error(` C Error al restaurar backup ${backupId}:`, error);
        res.status(500).json({ 
            message: 'Error al restaurar respaldo: ' + error.message,
            error: error.message
        });
    }
};

const eliminarBackup = async (req, res) => {
    const backupId = req.params.id;
    console.log(` C Controlador: Petición DELETE a /api/settings/backups/${backupId}`);
    
    if (!backupId) {
        return res.status(400).json({ message: 'ID de respaldo no proporcionado.' });
    }
    
    try {
        // Buscar el registro del backup
        const clave = `backup_${backupId}`;
        const backupConfig = await Configuracion.findOne({
            where: { clave },
            raw: true
        });
        
        if (!backupConfig) {
            return res.status(404).json({ message: 'Respaldo no encontrado.' });
        }
        
        let archivoEliminado = false;
        
        // Intentar eliminar el archivo físico si existe
        try {
            const backupData = JSON.parse(backupConfig.valor);
            if (backupData.ruta && await fileExists(backupData.ruta)) {
                await fs.unlink(backupData.ruta);
                archivoEliminado = true;
                console.log(` C Archivo de backup eliminado: ${backupData.ruta}`);
            }
        } catch (fileError) {
            console.error(` C Error al eliminar archivo de backup:`, fileError);
            // Continuamos con la eliminación del registro aunque falle la eliminación del archivo
        }
        
        // Eliminar el registro de la base de datos
        const resultado = await Configuracion.destroy({
            where: { clave }
        });
        
        res.status(200).json({ 
            message: 'Respaldo eliminado correctamente.' +
                     (archivoEliminado ? '' : ' (Nota: el archivo físico no pudo ser eliminado)')
        });
    } catch (error) {
        console.error(` C Error al eliminar backup ${backupId}:`, error);
        res.status(500).json({ 
            message: 'Error al eliminar respaldo: ' + error.message,
            error: error.message
        });
    }
};

// Función auxiliar para verificar si un archivo existe
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// --- Funciones para notificaciones por WhatsApp ---

const enviarNotificacion = async (req, res) => {
    console.log(' C Controlador: Petición POST a /api/settings/whatsapp/notify');
    const { clienteId, mensaje, tipo, cobroId } = req.body;
    
    if (!clienteId || !mensaje) {
        return res.status(400).json({ message: 'Se requiere ID de cliente y mensaje.' });
    }
    
    try {
        // Verificar estado de WhatsApp
        const whatsappStatus = await whatsappService.getStatus();
        
        if (whatsappStatus.status !== 'connected') {
            return res.status(400).json({ 
                message: 'WhatsApp no está conectado. Conéctelo primero.' 
            });
        }
        
        // Buscar datos del cliente
        const cliente = await sequelize.models.Cliente.findByPk(clienteId);
        if (!cliente) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }
        
        if (!cliente.telefono) {
            return res.status(400).json({ 
                message: 'El cliente no tiene número de teléfono registrado.' 
            });
        }
        
        // Enviar mensaje usando el servicio de WhatsApp
        const resultado = await whatsappService.sendMessage(
            cliente.telefono,
            mensaje,
            { tipo: tipo || 'recordatorio' }
        );
        
        // Registrar notificación enviada
        const idNotificacion = `notification_${Date.now()}`;
        await Configuracion.create({
            clave: idNotificacion,
            valor: JSON.stringify({
                clienteId,
                cobroId,
                telefono: cliente.telefono,
                mensaje,
                tipo: tipo || 'recordatorio',
                fecha: new Date().toISOString(),
                messageId: resultado.wamid
            }),
            descripcion: 'Registro de notificación enviada'
        });
        
        res.status(200).json({
            message: 'Notificación enviada exitosamente.',
            destinatario: cliente.nombre_cliente,
            telefono: cliente.telefono,
            messageId: resultado.wamid
        });
    } catch (error) {
        console.error(' C Error al enviar notificación:', error);
        res.status(500).json({ 
            message: 'Error al enviar notificación por WhatsApp: ' + error.message,
            error: error.message
        });
    }
};

// --- Obtener y Marcar Notificaciones ---

const obtenerNotificaciones = async (req, res) => {
    console.log(' C Controlador: Petición GET a /api/notificaciones');
    
    try {
        // Obtener registros de notificaciones desde configuraciones
        const notificacionesConfig = await Configuracion.findAll({
            where: sequelize.where(
                sequelize.fn('substring', sequelize.col('clave'), 1, 13),
                'notification_'
            ),
            order: [['ultima_modificacion', 'DESC']], // Más recientes primero
            limit: 10, // Limitar a las 10 más recientes
            raw: true
        });
        
        // Transformar a formato amigable
        const notificaciones = notificacionesConfig.map(config => {
            try {
                const notifData = JSON.parse(config.valor);
                // Calcular tiempo transcurrido
                const fechaEnvio = new Date(notifData.fecha);
                const ahora = new Date();
                const minutosTranscurridos = Math.floor((ahora - fechaEnvio) / (1000 * 60));
                
                let tiempoTexto;
                if (minutosTranscurridos < 60) {
                    tiempoTexto = `Hace ${minutosTranscurridos} ${minutosTranscurridos === 1 ? 'minuto' : 'minutos'}`;
                } else if (minutosTranscurridos < 24 * 60) {
                    const horas = Math.floor(minutosTranscurridos / 60);
                    tiempoTexto = `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
                } else {
                    const dias = Math.floor(minutosTranscurridos / (60 * 24));
                    if (dias === 1) {
                        tiempoTexto = 'Ayer';
                    } else {
                        tiempoTexto = `Hace ${dias} días`;
                    }
                }
                
                // Extraer info del cliente (a futuro, se podría hacer un join con la tabla de clientes)
                return {
                    id: config.clave,
                    tipo: notifData.tipo === 'recordatorio' ? 'warning' : 
                          notifData.tipo === 'recibo' ? 'success' : 'info',
                    mensaje: notifData.mensaje.length > 50 ? 
                            notifData.mensaje.substring(0, 50) + '...' : 
                            notifData.mensaje,
                    tiempo: tiempoTexto,
                    fecha: notifData.fecha,
                    clienteId: notifData.clienteId,
                    cobroId: notifData.cobroId,
                    leida: notifData.leida || false
                };
            } catch (e) {
                return {
                    id: config.clave,
                    tipo: 'error',
                    mensaje: 'Formato de notificación inválido',
                    tiempo: 'Desconocido',
                    leida: true
                };
            }
        });
        
        res.status(200).json({ notificaciones });
    } catch (error) {
        console.error(' C Error al obtener notificaciones:', error);
        res.status(500).json({ 
            message: 'Error al obtener notificaciones: ' + error.message,
            error: error.message
        });
    }
};

const marcarLeida = async (req, res) => {
    const notificacionId = req.params.id;
    console.log(` C Controlador: Petición POST a /api/notificaciones/${notificacionId}/marcar-leida`);
    
    try {
        // Buscar la notificación
        const notificacion = await Configuracion.findOne({
            where: { clave: notificacionId },
            raw: true
        });
        
        if (!notificacion) {
            return res.status(404).json({ message: 'Notificación no encontrada.' });
        }
        
        // Actualizar para marcar como leída
        try {
            const notifData = JSON.parse(notificacion.valor);
            notifData.leida = true;
            
            await Configuracion.update(
                { valor: JSON.stringify(notifData) },
                { where: { clave: notificacionId } }
            );
            
            res.status(200).json({ 
                message: 'Notificación marcada como leída correctamente.',
                id: notificacionId
            });
        } catch (parseError) {
            return res.status(400).json({ message: 'Formato de notificación inválido.' });
        }
    } catch (error) {
        console.error(` C Error al marcar notificación ${notificacionId} como leída:`, error);
        res.status(500).json({ 
            message: 'Error al marcar notificación como leída: ' + error.message,
            error: error.message
        });
    }
};

const marcarTodasLeidas = async (req, res) => {
    console.log(' C Controlador: Petición POST a /api/notificaciones/marcar-todas-leidas');
    
    try {
        // Obtener todas las notificaciones
        const notificaciones = await Configuracion.findAll({
            where: sequelize.where(
                sequelize.fn('substring', sequelize.col('clave'), 1, 13),
                'notification_'
            ),
            raw: true
        });
        
        // Actualizar cada notificación
        let actualizadas = 0;
        for (const notif of notificaciones) {
            try {
                const notifData = JSON.parse(notif.valor);
                if (!notifData.leida) {
                    notifData.leida = true;
                    await Configuracion.update(
                        { valor: JSON.stringify(notifData) },
                        { where: { clave: notif.clave } }
                    );
                    actualizadas++;
                }
            } catch (parseError) {
                console.error(`Error al procesar notificación ${notif.clave}:`, parseError);
                // Continuar con la siguiente
            }
        }
        
        res.status(200).json({ 
            message: `${actualizadas} notificaciones marcadas como leídas.`,
            cantidadActualizada: actualizadas
        });
    } catch (error) {
        console.error(' C Error al marcar todas las notificaciones como leídas:', error);
        res.status(500).json({ 
            message: 'Error al marcar notificaciones como leídas: ' + error.message,
            error: error.message
        });
    }
};

// Exportar funciones
module.exports = {
  obtenerConfiguraciones,
  actualizarConfiguraciones,
  obtenerEstadoWhatsApp,
  conectarWhatsAppAPI,
  desconectarWhatsApp,
  crearBackup,
  listarBackups,
  restaurarBackup,
  eliminarBackup,
  enviarNotificacion,
  obtenerNotificaciones,
  marcarLeida,
  marcarTodasLeidas
};

console.log(' C Controlador de Settings cargado.');