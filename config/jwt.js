// Importar las variables de entorno
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error("❌ Error: La variable de entorno JWT_SECRET no está definida.");
  console.log("Asegúrate de tener un archivo .env con JWT_SECRET=tu_clave_secreta");
  process.exit(1); // Detener la aplicación si no hay clave secreta
} else {
    console.log("🔑 Clave secreta JWT cargada.");
}

module.exports = {
  secret: jwtSecret
};