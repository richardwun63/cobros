// utils/logger.util.js
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

/**
 * Clase que proporciona funcionalidades de registro (logging)
 * para la aplicación PEGASUS.
 */
class Logger {
    constructor() {
        // Directorio para guardar los logs
        this.logDir = path.join(__dirname, '..', 'logs');
        
        // Crear el directorio de logs si no existe
        if (!fs.existsSync(this.logDir)) {
            try {
                fs.mkdirSync(this.logDir, { recursive: true });
                console.log(`Directorio de logs creado: ${this.logDir}`);
            } catch (error) {
                console.error(`Error al crear directorio de logs: ${error.message}`);
            }
        }
        
        // Archivo de log actual basado en la fecha
        this.updateLogFile();
        
        // Niveles de log y sus colores para la consola
        this.levels = {
            ERROR: '\x1b[31m', // Rojo
            WARN: '\x1b[33m',  // Amarillo
            INFO: '\x1b[36m',  // Cian
            DEBUG: '\x1b[32m', // Verde
            TRACE: '\x1b[37m'  // Blanco
        };
        
        // Reset color
        this.reset = '\x1b[0m';
        
        // Configuración del nivel de log (se puede cambiar en runtime)
        this.logLevel = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';
        
        // Mapa para ordenar niveles de logs
        this.levelOrder = {
            'ERROR': 0,
            'WARN': 1,
            'INFO': 2,
            'DEBUG': 3,
            'TRACE': 4
        };
        
        // Intervalo para actualizar el archivo de log diariamente
        setInterval(() => this.updateLogFile(), 3600000); // Cada hora
        
        this.info('Logger iniciado');
    }
    
    /**
     * Actualiza el archivo de log al del día actual
     */
    updateLogFile() {
        const prevLogFile = this.logFile;
        this.logFile = path.join(
            this.logDir, 
            `pegasus_${format(new Date(), 'yyyy-MM-dd')}.log`
        );
        
        if (prevLogFile !== this.logFile) {
            console.log(`Archivo de log actualizado: ${this.logFile}`);
        }
    }
    
    /**
     * Escribe un mensaje de log en el archivo y la consola
     * @param {string} level - Nivel de log (ERROR, WARN, INFO, DEBUG, TRACE)
     * @param {string} message - Mensaje a registrar
     * @param {Object|Error} data - Datos adicionales para registrar (opcional)
     */
    log(level, message, data = null) {
        // Si el nivel de log es mayor al configurado, no hacer nada
        if (!this.levels[level] || this.levelOrder[level] > this.levelOrder[this.logLevel]) {
            return;
        }
        
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        
        // Crear entrada de log
        let logEntry = `[${timestamp}] [${level}] ${message}`;
        
        // Manejar errores específicamente
        if (data instanceof Error) {
            logEntry += ` Error: ${data.message}`;
            if (data.stack) {
                logEntry += `\nStack: ${data.stack}`;
            }
        }
        // Añadir datos si existen
        else if (data) {
            try {
                if (typeof data === 'object') {
                    logEntry += ` ${JSON.stringify(data)}`;
                } else {
                    logEntry += ` ${data}`;
                }
            } catch (error) {
                logEntry += ` [Error al serializar datos: ${error.message}]`;
            }
        }
        
        // Añadir salto de línea para el archivo
        logEntry += '\n';
        
        // Escribir en archivo de log
        try {
            fs.appendFileSync(this.logFile, logEntry);
        } catch (error) {
            console.error(`Error escribiendo en archivo de log: ${error.message}`);
        }
        
        // Mostrar en consola con colores
        console.log(`${this.levels[level]}${logEntry}${this.reset}`);
    }
    
    /**
     * Registra un mensaje de nivel ERROR
     * @param {string} message - Mensaje a registrar
     * @param {Object|Error} data - Datos adicionales (opcional)
     */
    error(message, data = null) {
        this.log('ERROR', message, data);
    }
    
    /**
     * Registra un mensaje de nivel WARN
     * @param {string} message - Mensaje a registrar
     * @param {Object|Error} data - Datos adicionales (opcional)
     */
    warn(message, data = null) {
        this.log('WARN', message, data);
    }
    
    /**
     * Registra un mensaje de nivel INFO
     * @param {string} message - Mensaje a registrar
     * @param {Object|Error} data - Datos adicionales (opcional)
     */
    info(message, data = null) {
        this.log('INFO', message, data);
    }
    
    /**
     * Registra un mensaje de nivel DEBUG
     * @param {string} message - Mensaje a registrar
     * @param {Object|Error} data - Datos adicionales (opcional)
     */
    debug(message, data = null) {
        this.log('DEBUG', message, data);
    }
    
    /**
     * Registra un mensaje de nivel TRACE
     * @param {string} message - Mensaje a registrar
     * @param {Object|Error} data - Datos adicionales (opcional)
     */
    trace(message, data = null) {
        this.log('TRACE', message, data);
    }
    
    /**
     * Cambia el nivel de log en tiempo de ejecución
     * @param {string} level - Nuevo nivel (ERROR, WARN, INFO, DEBUG, TRACE)
     * @returns {boolean} - true si el cambio fue exitoso
     */
    setLogLevel(level) {
        if (this.levels[level]) {
            this.logLevel = level;
            this.info(`Nivel de log cambiado a: ${level}`);
            return true;
        }
        this.warn(`Nivel de log inválido: ${level}`);
        return false;
    }
    
    /**
     * Obtiene el nivel de log actual
     * @returns {string} - Nivel de log actual
     */
    getLogLevel() {
        return this.logLevel;
    }
    
    /**
     * Limpia logs antiguos (más de N días)
     * @param {number} days - Días a mantener (por defecto 30)
     */
    cleanOldLogs(days = 30) {
        try {
            const now = new Date();
            const logFiles = fs.readdirSync(this.logDir);
            
            logFiles.forEach(file => {
                if (file.startsWith('pegasus_') && file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = fs.statSync(filePath);
                    const fileDate = new Date(stats.mtime);
                    const diffDays = Math.floor((now - fileDate) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays > days) {
                        fs.unlinkSync(filePath);
                        this.info(`Log antiguo eliminado: ${file}`);
                    }
                }
            });
            
            this.info(`Limpieza de logs completada. Se mantienen logs de ${days} días.`);
        } catch (error) {
            this.error('Error al limpiar logs antiguos:', error);
        }
    }
}

// Exportar una única instancia del logger
module.exports = new Logger();