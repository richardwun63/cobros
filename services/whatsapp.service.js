// services/whatsapp.service.js
/**
 * Servicio para la integración con WhatsApp Business API
 * Esta implementación utiliza la API oficial de Meta para WhatsApp Business
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Configuracion } = require('../models');
const { format } = require('date-fns');
const logger = require('../utils/logger.util');

// Configuraciones
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'whatsapp.json');
const SESSION_DIR = path.join(__dirname, '..', 'sessions');

// Asegurarse de que exista el directorio de sesiones
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Asegurarse de que exista el directorio de configuración
if (!fs.existsSync(path.dirname(CONFIG_PATH))) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
}

// services/whatsapp.service.js

class WhatsAppService {
    constructor() {
        this.isConnected = false;
        this.connectionPhoneNumber = null;
        this.config = {
            apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0',
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN
        };
        
        // Cargar configuración desde .env o archivo si existe
        this.loadConfig();
    }

    /**
     * Carga la configuración desde un archivo o variables de entorno
     */
    loadConfig() {
        try {
            // Intentar cargar desde archivo si existe
            if (fs.existsSync(CONFIG_PATH)) {
                const configFile = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                this.config = { ...this.config, ...configFile };
                logger.info('Configuración de WhatsApp cargada desde archivo local');
            }
            
            // Verificar si hay valores guardados en la base de datos
            this.loadConfigFromDatabase().catch(err => {
                logger.error('Error al cargar configuración de WhatsApp desde BD:', err);
            });
            
        } catch (error) {
            logger.error('Error al cargar configuración de WhatsApp:', error);
        }
    }

    /**
     * Guarda las credenciales de API
     * @param {Object} credentials - Credenciales (phoneNumberId, accessToken)
     * @returns {Promise<Object>} - Confirmación
     */
    async saveCredentials(credentials) {
        try {
            // Validar datos mínimos
            if (!credentials.phoneNumberId || !credentials.accessToken) {
                throw new Error('Se requieren phoneNumberId y accessToken');
            }
            
            // Actualizar configuración local
            this.config.phoneNumberId = credentials.phoneNumberId;
            this.config.accessToken = credentials.accessToken;
            if (credentials.apiUrl) this.config.apiUrl = credentials.apiUrl;
            
            // Guardar en la base de datos
            await Promise.all([
                Configuracion.upsert({
                    clave: 'whatsapp_phone_id',
                    valor: credentials.phoneNumberId,
                    descripcion: 'ID de número telefónico para WhatsApp Business API'
                }),
                Configuracion.upsert({
                    clave: 'whatsapp_access_token',
                    valor: credentials.accessToken,
                    descripcion: 'Token de acceso para WhatsApp Business API'
                })
            ]);
            
            if (credentials.apiUrl) {
                await Configuracion.upsert({
                    clave: 'whatsapp_api_url',
                    valor: credentials.apiUrl,
                    descripcion: 'URL de API de WhatsApp Business'
                });
            }
            
            // Guardar también en archivo local (opcional para redundancia)
            const configToSave = {
                phoneNumberId: credentials.phoneNumberId,
                accessToken: credentials.accessToken
            };
            if (credentials.apiUrl) configToSave.apiUrl = credentials.apiUrl;
            
            fs.writeFileSync(
                CONFIG_PATH,
                JSON.stringify(configToSave, null, 2),
                'utf8'
            );
            
            logger.info('Credenciales de WhatsApp guardadas correctamente');
            return { success: true, message: 'Credenciales guardadas correctamente' };
        } catch (error) {
            logger.error('Error al guardar credenciales de WhatsApp:', error);
            throw error;
        }
    }

    /**
     * Inicia una conexión con WhatsApp Business API
     * @returns {Promise<Object>} - Información de la conexión
     */
    async connect() {
        try {
            // Verificar si ya tenemos las credenciales necesarias
            if (!this.config.phoneNumberId || !this.config.accessToken) {
                logger.error('Faltan credenciales de WhatsApp Business API');
                throw new Error('Faltan credenciales de WhatsApp Business API. Configure phoneNumberId y accessToken.');
            }
            
            // Verificar la conexión haciendo una solicitud de prueba
            const response = await axios.get(
                `${this.config.apiUrl}/${this.config.phoneNumberId}?fields=verified_name,quality_rating`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (response.status === 200 && response.data) {
                // Extraer información del número de teléfono
                const phoneInfo = response.data;
                const verifiedName = phoneInfo.verified_name || 'Sin nombre verificado';
                
                // Guardar estado de conexión
                await this.saveConnectionState(true, verifiedName);
                
                logger.info(`Conexión exitosa con WhatsApp Business API: ${verifiedName}`);
                return {
                    status: 'connected',
                    verifiedName,
                    phoneNumberId: this.config.phoneNumberId
                };
            } else {
                throw new Error('No se pudo verificar la conexión con WhatsApp Business API');
            }
        } catch (error) {
            logger.error('Error al conectar con WhatsApp:', error.message);
            
            // Si el error es de autenticación o token expirado
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                throw new Error('Error de autenticación. Verifique su accessToken.');
            }
            
            throw new Error(`Error al conectar con WhatsApp: ${error.message}`);
        }
    }

    /**
     * Envía un mensaje WhatsApp a un número específico
     * @param {string} to - Número de teléfono destino (con código de país)
     * @param {string} message - Texto del mensaje
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} - Confirmación de envío
     */
    async sendMessage(to, message, options = {}) {
        try {
            // Verificar si está conectado
            const status = await this.getStatus();
            if (status.status !== 'connected') {
                throw new Error('No hay conexión activa con WhatsApp');
            }
            
            // Preparar el número de teléfono (eliminar formatos, símbolos, etc.)
            let phoneNumber = to.replace(/\D/g, '');
            
            // Asegurarse que empiece con código de país
            if (!phoneNumber.startsWith('51') && !phoneNumber.startsWith('+51')) {
                phoneNumber = '51' + phoneNumber;
            }
            
            // Eliminar el + si existe
            phoneNumber = phoneNumber.replace('+', '');
            
            // Estructura del mensaje para la API de WhatsApp
            const messageData = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phoneNumber,
                type: "text",
                text: {
                    body: message
                }
            };
            
            // Enviar el mensaje
            const response = await axios.post(
                `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`,
                messageData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (response.status === 200 || response.status === 201) {
                logger.info(`Mensaje WhatsApp enviado a ${phoneNumber}`);
                
                // Guardar registro de mensaje enviado
                try {
                    await Configuracion.create({
                        clave: `whatsapp_message_${Date.now()}`,
                        valor: JSON.stringify({
                            to: phoneNumber,
                            message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
                            timestamp: new Date().toISOString(),
                            messageId: response.data.messages?.[0]?.id || 'unknown'
                        }),
                        descripcion: 'Registro de mensaje WhatsApp enviado'
                    });
                } catch (logError) {
                    logger.error('Error al registrar mensaje enviado:', logError);
                    // No interrumpir el flujo si falla el registro
                }
                
                return {
                    success: true,
                    wamid: response.data.messages?.[0]?.id,
                    to: phoneNumber
                };
            } else {
                throw new Error(`Error al enviar mensaje. Código: ${response.status}`);
            }
        } catch (error) {
            logger.error('Error en envío de mensaje WhatsApp:', error.message);
            
            if (error.response && error.response.data) {
                logger.error('Detalles de error de API:', JSON.stringify(error.response.data));
                
                // Si el error es de autenticación, marcar como desconectado
                if (error.response.status === 401 || error.response.status === 403) {
                    await this.saveConnectionState(false);
                }
            }
            
            throw new Error(`Error al enviar mensaje WhatsApp: ${error.message}`);
        }
    }

    // Otros métodos no modificados...
}

// Exportar una instancia única del servicio
module.exports = new WhatsAppService();

// Exportar una instancia única del servicio
module.exports = new WhatsAppService();