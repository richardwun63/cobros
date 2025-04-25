// utils/setup.js
/**
 * Script de configuración inicial para el sistema PEGASUS
 * Este script verifica y configura todos los componentes necesarios
 * para que el sistema funcione correctamente
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

// Directorios necesarios
const DIRS = [
    'logs',
    'backups',
    'sessions',
    'config'
];

// Archivo .env de ejemplo
const ENV_EXAMPLE = `# Configuración Base de Datos MySQL
DB_HOST=localhost
DB_USER=pegasus_user
DB_PASSWORD=pegasus_password
DB_NAME=pegasus_cobros
DB_PORT=3306 # Puerto estándar de MySQL

# Configuración del Servidor
PORT=3001 # Puerto donde correrá el backend

# Clave Secreta para JWT (JSON Web Tokens) - ¡Cambiar por algo seguro!
JWT_SECRET=ClaveSecreta_PEGASUS_JWT_2025_$#!%&

# Entorno (development, production)
NODE_ENV=development

# Configuración WhatsApp (opcional)
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
`;

// Verifica si un comando está disponible
function commandExists(command) {
    try {
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

// Crea los directorios necesarios
function createDirectories() {
    console.log('\n🔧 Creando directorios necesarios...');
    
    DIRS.forEach(dir => {
        const dirPath = path.join(__dirname, '..', dir);
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`  ✅ Directorio creado: ${dir}`);
            } catch (error) {
                console.error(`  ❌ Error al crear directorio ${dir}:`, error.message);
            }
        } else {
            console.log(`  ✓ Directorio ya existe: ${dir}`);
        }
    });
}

// Verifica si existe archivo .env, si no lo crea
function checkEnvFile() {
    console.log('\n🔧 Verificando archivo .env...');
    
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
        try {
            fs.writeFileSync(envPath, ENV_EXAMPLE, 'utf8');
            console.log('  ✅ Archivo .env creado con valores por defecto.');
            console.log('  ⚠️ IMPORTANTE: Edita el archivo .env con tus configuraciones reales.');
        } catch (error) {
            console.error('  ❌ Error al crear archivo .env:', error.message);
        }
    } else {
        console.log('  ✓ Archivo .env ya existe.');
    }
}

// Verifica la conexión a MySQL
async function checkMySQLConnection() {
    console.log('\n🔧 Verificando conexión a MySQL...');
    
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };
    
    try {
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password
        });
        
        console.log('  ✅ Conexión a MySQL exitosa.');
        
        // Verificar si existe la base de datos
        const [rows] = await connection.execute(
            `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`, 
            [dbConfig.database]
        );
        
        if (rows.length === 0) {
            console.log(`  ℹ️ Base de datos '${dbConfig.database}' no encontrada.`);
            
            // Preguntar si desea crear la base de datos
            console.log('  ℹ️ Para crear la base de datos, ejecuta:');
            console.log(`  mysql -u ${dbConfig.user} -p < MySQL.sql`);
        } else {
            console.log(`  ✓ Base de datos '${dbConfig.database}' encontrada.`);
            
            // Verificar tablas esenciales
            const tables = ['usuarios', 'roles', 'clientes', 'cobros', 'servicios', 'configuraciones'];
            let allTablesExist = true;
            
            for (const table of tables) {
                try {
                    const [tableCheck] = await connection.execute(
                        `SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = ? AND table_name = ?`,
                        [dbConfig.database, table]
                    );
                    
                    if (tableCheck.length === 0) {
                        console.log(`  ❌ Tabla '${table}' no encontrada.`);
                        allTablesExist = false;
                    }
                } catch (tableError) {
                    console.error(`  ❌ Error al verificar tabla '${table}':`, tableError.message);
                    allTablesExist = false;
                }
            }
            
            if (!allTablesExist) {
                console.log('  ℹ️ No se encontraron todas las tablas necesarias.');
                console.log('  ℹ️ Para crear las tablas, ejecuta:');
                console.log(`  mysql -u ${dbConfig.user} -p ${dbConfig.database} < MySQL.sql`);
            } else {
                console.log('  ✅ Todas las tablas necesarias existen.');
            }
        }
        
        await connection.end();
    } catch (error) {
        console.error('  ❌ Error de conexión a MySQL:', error.message);
        console.log('  ⚠️ Verifica las credenciales en el archivo .env');
    }
}

// Verifica las dependencias
function checkDependencies() {
    console.log('\n🔧 Verificando dependencias...');
    
    // Verificar MySQL
    if (commandExists('mysql')) {
        console.log('  ✅ MySQL encontrado en el sistema.');
    } else {
        console.log('  ⚠️ MySQL no encontrado. Asegúrate de tener MySQL instalado.');
    }
    
    // Verificar Node.js
    const nodeVersion = process.version;
    console.log(`  ✅ Node.js ${nodeVersion} encontrado.`);
    
    // Verificar NPM
    try {
        const npmVersion = execSync('npm --version').toString().trim();
        console.log(`  ✅ NPM ${npmVersion} encontrado.`);
    } catch (error) {
        console.log('  ⚠️ Error al verificar versión de NPM.');
    }
}

// Función principal asíncrona
async function main() {
    console.log('🚀 Iniciando configuración de PEGASUS...');
    
    createDirectories();
    checkEnvFile();
    await checkMySQLConnection();
    checkDependencies();
    
    console.log('\n✨ Configuración completada.');
    console.log('\n📝 Pasos siguientes:');
    console.log('1. Verifica y ajusta el archivo .env con tus configuraciones');
    console.log('2. Asegúrate de que la base de datos esté creada');
    console.log('3. Inicia el servidor con: npm start');
    console.log('\n¡Gracias por usar el Sistema de Cobros PEGASUS! 🎉');
}

// Ejecutar función principal
main().catch(error => {
    console.error('Error en la configuración:', error);
});