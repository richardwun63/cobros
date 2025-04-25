const bcrypt = require('bcryptjs');
const passwordPlana = 'admin123'; // <-- PON AQUÍ LA CONTRASEÑA QUE QUIERES USAR

bcrypt.genSalt(10, (err, salt) => {
  if (err) {
    console.error("Error generando salt:", err);
    return;
  }
  bcrypt.hash(passwordPlana, salt, (err, hash) => {
    if (err) {
      console.error("Error generando hash:", err);
      return;
    }
    console.log(`Contraseña Plana: ${passwordPlana}`);
    console.log(`Hash Generado: ${hash}`);
    console.log("\nCopia y pega este Hash Generado en tu consulta SQL INSERT.");
  });
});