// services/database.service.js
const { sequelize } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('../utils/logger.util');

/**
 * Servicio de gestión de base de datos que proporciona métodos
 * para operaciones relacionadas con la base de datos
 */
class DatabaseService {
    /**
     * Verifica la conexión a la base de datos
     * @returns {Promise<boolean>} - true si la conexión es exitosa
     * @throws {Error} - Si no se pudo conectar
     */
    async testConnection() {
        try {
            await sequelize.authenticate();
            logger.info('✅ Conexión a la base de datos establecida correctamente.');
            return true;
        } catch (error) {
            logger.error('❌ No se pudo conectar a la base de datos:', error);
            throw error;
        }
    }

    /**
     * Ejecuta una consulta SQL directa
     * @param {string} query - Consulta SQL a ejecutar
     * @param {Array} replacements - Parámetros para la consulta 
     * @param {Object} options - Opciones adicionales para la consulta
     * @returns {Promise<Array>} - Resultado de la consulta
     */
    async executeQuery(query, replacements = [], options = {}) {
        try {
            const [results] = await sequelize.query(query, {
                replacements,
                ...options
            });
            return results;
        } catch (error) {
            logger.error('Error ejecutando consulta SQL:', error);
            throw error;
        }
    }

    /**
     * Crea un backup de la base de datos
     * @param {string} outputDir - Directorio donde se guardará el backup
     * @returns {Promise<Object>} - Información del archivo de backup
     */
    async createBackup(outputDir = 'backups') {
        try {
            // Obtener credenciales de .env
            const dbName = process.env.DB_NAME;
            const dbUser = process.env.DB_USER;
            const dbPassword = process.env.DB_PASSWORD;
            const dbHost = process.env.DB_HOST || 'localhost';
            const dbPort = process.env.DB_PORT || '3306';
            
            // Validar que existen las credenciales
            if (!dbName || !dbUser || !dbPassword) {
                throw new Error('Faltan credenciales de base de datos para realizar el backup.');
            }
            
            // Crear directorio de backups si no existe
            try {
                await fs.mkdir(outputDir, { recursive: true });
                logger.info(`Directorio de backups creado: ${outputDir}`);
            } catch (err) {
                // Ignorar error si el directorio ya existe
                if (err.code !== 'EEXIST') {
                    throw err;
                }
                logger.info(`El directorio de backups ya existe: ${outputDir}`);
            }
            
            // Generar nombre de archivo con fecha y hora
            const date = new Date();
            const formattedDate = date.toISOString()
                .replace(/[:.]/g, '-')
                .replace('T', '_')
                .slice(0, 19);
            
            const backupFileName = `backup_${formattedDate}.sql`;
            const backupPath = path.join(outputDir, backupFileName);
            
            // Configurar opciones para mysqldump (compatible con MySQL 8.0.41)
            // Importante: no usar marcadores de posición para LIMIT/OFFSET en MySQL 8.x
            const mysqldumpCommand = [
                'mysqldump',
                `--host=${dbHost}`,
                `--port=${dbPort}`,
                `--user=${dbUser}`,
                `--password=${dbPassword}`,
                '--single-transaction',
                '--skip-lock-tables',
                '--set-gtid-purged=OFF',
                '--no-tablespaces',
                '--routines',
                '--triggers',
                '--events',
                '--opt',  // Opción optimizada para MySQL 8
                dbName,
                `> "${backupPath}"`
            ].join(' ');
            
            logger.info(`Ejecutando backup con comando: mysqldump --host=${dbHost} --port=${dbPort} --user=${dbUser} --password=XXXXX ${dbName} > "${backupPath}"`);
            
            try {
                // Ejecutar comando mysqldump
                await execPromise(mysqldumpCommand);
                
                // Verificar que el archivo existe y obtener su tamaño
                const stats = await fs.stat(backupPath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                
                // Verificar contenido mínimo del archivo (para asegurar que el backup es válido)
                const fileContent = await fs.readFile(backupPath, 'utf8', { maxSize: 1024 });
                if (!fileContent.includes('MySQL dump') && !fileContent.includes('CREATE TABLE')) {
                    throw new Error('El archivo de backup parece estar vacío o corrupto');
                }
                
                logger.info(`✅ Backup creado exitosamente en: ${backupPath} (${fileSizeMB} MB)`);
                
                return {
                    id: formattedDate,
                    fecha: date.toISOString(),
                    nombre: backupFileName,
                    tamanio: `${fileSizeMB} MB`,
                    ruta: backupPath
                };
            } catch (error) {
                logger.error('Error ejecutando mysqldump:', error);
                throw new Error(`Error al crear backup: ${error.message}`);
            }
        } catch (error) {
            logger.error('Error al crear backup:', error);
            throw error;
        }
    }

    /**
     * Restaura un backup de la base de datos
     * @param {string} backupPath - Ruta al archivo de backup
     * @returns {Promise<boolean>} - true si la restauración fue exitosa
     */
    async restoreBackup(backupPath) {
        try {
            // Obtener credenciales de .env
            const dbName = process.env.DB_NAME;
            const dbUser = process.env.DB_USER;
            const dbPassword = process.env.DB_PASSWORD;
            const dbHost = process.env.DB_HOST || 'localhost';
            const dbPort = process.env.DB_PORT || '3306';
            
            // Validar que existen las credenciales y el archivo
            if (!dbName || !dbUser || !dbPassword) {
                throw new Error('Faltan credenciales de base de datos para realizar la restauración.');
            }
            
            // Verificar que el archivo existe
            try {
                await fs.access(backupPath);
                logger.info(`Archivo de backup encontrado: ${backupPath}`);
                
                // Verificar formato del archivo
                const fileHeader = await fs.readFile(backupPath, 'utf8', { length: 1024 });
                if (!fileHeader.includes('MySQL dump')) {
                    throw new Error('El archivo no parece ser un backup de MySQL válido');
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    throw new Error(`El archivo de backup no existe: ${backupPath}`);
                }
                throw error;
            }
            
            // Comando para restaurar (compatible con MySQL 8.0.41)
            const mysqlCommand = [
                'mysql',
                `--host=${dbHost}`,
                `--port=${dbPort}`,
                `--user=${dbUser}`,
                `--password=${dbPassword}`,
                `--default-character-set=utf8mb4`,
                dbName,
                `< "${backupPath}"`
            ].join(' ');
            
            logger.info(`Ejecutando restauración con comando: mysql --host=${dbHost} --port=${dbPort} --user=${dbUser} --password=XXXXX ${dbName} < "${backupPath}"`);
            
            // Crear una copia de seguridad antes de restaurar
            const backupBeforeRestore = await this.createBackup('backups/before_restore');
            logger.info(`Backup de seguridad creado antes de restaurar: ${backupBeforeRestore.ruta}`);
            
            // Ejecutar comando mysql para restaurar
            try {
                await execPromise(mysqlCommand);
                logger.info(`✅ Backup restaurado exitosamente desde: ${backupPath}`);
                return true;
            } catch (execError) {
                logger.error(`Error durante la restauración: ${execError.message}`);
                
                // Intentar restaurar desde la copia de seguridad en caso de error
                logger.warn(`Intentando restaurar desde la copia de seguridad: ${backupBeforeRestore.ruta}`);
                try {
                    const restoreCommand = mysqlCommand.replace(backupPath, backupBeforeRestore.ruta);
                    await execPromise(restoreCommand);
                    logger.info('✅ Sistema restaurado a su estado original desde la copia de seguridad');
                } catch (restoreError) {
                    logger.error(`También falló la restauración de seguridad: ${restoreError.message}`);
                }
                
                throw new Error(`Error al restaurar backup: ${execError.message}`);
            }
        } catch (error) {
            logger.error('Error al restaurar backup:', error);
            throw error;
        }
    }

    /**
     * Obtiene la lista de tablas de la base de datos
     * @returns {Promise<Array>} - Lista de nombres de tablas
     */
    async getTables() {
        try {
            const query = `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = ?
                ORDER BY table_name
            `;
            
            const results = await this.executeQuery(query, [process.env.DB_NAME]);
            return results.map(row => row.table_name || row.TABLE_NAME);
        } catch (error) {
            logger.error('Error al obtener tablas de la base de datos:', error);
            throw error;
        }
    }

    /**
     * Obtiene información sobre una tabla específica
     * @param {string} tableName - Nombre de la tabla
     * @returns {Promise<Object>} - Información de la tabla
     */
    async getTableInfo(tableName) {
        try {
            // Obtener estructura de la tabla
            const columnsQuery = `
                SELECT column_name, column_type, is_nullable, column_key, column_default, extra 
                FROM information_schema.columns 
                WHERE table_schema = ? AND table_name = ?
                ORDER BY ordinal_position
            `;
            
            const columns = await this.executeQuery(columnsQuery, [process.env.DB_NAME, tableName]);
            
            // Obtener conteo de registros (sin usar marcadores para LIMIT en MySQL 8.0.41)
            const countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\``;
            const [countResult] = await this.executeQuery(countQuery);
            
            return {
                name: tableName,
                columns: columns,
                rowCount: countResult ? (countResult.total || 0) : 0
            };
        } catch (error) {
            logger.error(`Error al obtener información de la tabla ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta una optimización de todas las tablas
     * @returns {Promise<boolean>} - true si la optimización fue exitosa
     */
    async optimizeTables() {
        try {
            // Obtener lista de tablas
            const tables = await this.getTables();
            const results = {};
            
            // Para cada tabla, ejecutar OPTIMIZE TABLE
            for (const table of tables) {
                logger.info(`Optimizando tabla: ${table}`);
                try {
                    await this.executeQuery(`OPTIMIZE TABLE \`${table}\``);
                    results[table] = true;
                } catch (tableError) {
                    logger.error(`Error optimizando tabla ${table}:`, tableError);
                    results[table] = false;
                }
            }
            
            const successCount = Object.values(results).filter(r => r === true).length;
            logger.info(`Optimización completada: ${successCount} de ${tables.length} tablas optimizadas`);
            
            return {
                success: successCount === tables.length,
                totalTables: tables.length,
                optimizedTables: successCount,
                details: results
            };
        } catch (error) {
            logger.error('Error al optimizar tablas:', error);
            throw error;
        }
    }

    /**
     * Verifica la integridad de las tablas
     * @returns {Promise<Object>} - Resultado de la verificación
     */
    async checkTableIntegrity() {
        try {
            // Obtener lista de tablas
            const tables = await this.getTables();
            const results = {};
            let allTablesOk = true;
            
            // Para cada tabla, ejecutar CHECK TABLE
            for (const table of tables) {
                logger.info(`Verificando integridad de tabla: ${table}`);
                try {
                    const checkResult = await this.executeQuery(`CHECK TABLE \`${table}\``);
                    const tableOk = checkResult[0]?.Msg_text === 'OK';
                    results[table] = {
                        status: tableOk ? 'OK' : 'Error',
                        message: checkResult[0]?.Msg_text || 'Desconocido'
                    };
                    
                    if (!tableOk) allTablesOk = false;
                } catch (tableError) {
                    logger.error(`Error verificando tabla ${table}:`, tableError);
                    results[table] = {
                        status: 'Error',
                        message: tableError.message
                    };
                    allTablesOk = false;
                }
            }
            
            logger.info(`Verificación de integridad completada: ${tables.length} tablas verificadas`);
            return {
                success: allTablesOk,
                totalTables: tables.length,
                details: results
            };
        } catch (error) {
            logger.error('Error al verificar integridad de tablas:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene información del sistema de base de datos
     * @returns {Promise<Object>} - Información del sistema
     */
    async getSystemInfo() {
        try {
            // Información de la versión de MySQL
            const versionQuery = "SELECT VERSION() as version";
            const [versionResult] = await this.executeQuery(versionQuery);
            
            // Información del tamaño de la base de datos
            const sizeQuery = `
                SELECT 
                    SUM(data_length + index_length) / 1024 / 1024 AS size_mb
                FROM information_schema.tables
                WHERE table_schema = ?
            `;
            const [sizeResult] = await this.executeQuery(sizeQuery, [process.env.DB_NAME]);
            
            // Información del tamaño de cada tabla
            const tablesSizeQuery = `
                SELECT 
                    table_name,
                    data_length / 1024 / 1024 AS data_size_mb,
                    index_length / 1024 / 1024 AS index_size_mb,
                    (data_length + index_length) / 1024 / 1024 AS total_size_mb,
                    table_rows
                FROM information_schema.tables
                WHERE table_schema = ?
                ORDER BY (data_length + index_length) DESC
            `;
            const tablesSize = await this.executeQuery(tablesSizeQuery, [process.env.DB_NAME]);
            
            // Variables del sistema
            const variablesQuery = `
                SHOW VARIABLES LIKE 'max_connections';
            `;
            const variables = await this.executeQuery(variablesQuery);
            
            // Formatear variables como un objeto
            const variablesObj = {};
            variables.forEach(v => {
                variablesObj[v.Variable_name] = v.Value;
            });
            
            return {
                version: versionResult?.version || 'Desconocida',
                databaseName: process.env.DB_NAME,
                databaseSize: {
                    mb: parseFloat(sizeResult?.size_mb || 0).toFixed(2),
                    tables: tablesSize.map(t => ({
                        name: t.table_name,
                        dataSizeMb: parseFloat(t.data_size_mb || 0).toFixed(2),
                        indexSizeMb: parseFloat(t.index_size_mb || 0).toFixed(2),
                        totalSizeMb: parseFloat(t.total_size_mb || 0).toFixed(2),
                        rows: parseInt(t.table_rows || 0)
                    }))
                },
                variables: variablesObj
            };
        } catch (error) {
            logger.error('Error al obtener información del sistema:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();