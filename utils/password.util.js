// utils/password.util.js
/**
 * Utilidades para el manejo seguro de contraseñas
 * Proporciona funciones para generar hashes, verificar contraseñas
 * y evaluar su fortaleza
 */

const bcrypt = require('bcryptjs');
const logger = require('./logger.util');

// Configuración de bcrypt
const SALT_ROUNDS = 12; // Mayor valor = más seguro pero más lento

/**
 * Genera un hash seguro de una contraseña usando bcrypt
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} - Hash generado
 */
async function generateHash(password) {
  try {
    // Generar un salt (valor aleatorio) para hacer cada hash único
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    
    // Generar el hash con el salt
    const hash = await bcrypt.hash(password, salt);
    
    return hash;
  } catch (error) {
    logger.error('Error al generar hash de contraseña:', error);
    throw new Error('Error al procesar la contraseña.');
  }
}

/**
 * Verifica si una contraseña coincide con un hash
 * @param {string} password - Contraseña en texto plano
 * @param {string} hash - Hash almacenado
 * @returns {Promise<boolean>} - true si coinciden
 */
async function comparePassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Error al comparar contraseña:', error);
    throw new Error('Error al verificar la contraseña.');
  }
}

/**
 * Evalúa la fortaleza de una contraseña
 * @param {string} password - Contraseña a evaluar
 * @returns {Object} - Resultado de la evaluación
 */
function evaluateStrength(password) {
  if (!password) {
    return {
      isValid: false,
      score: 0,
      feedback: ['La contraseña no puede estar vacía']
    };
  }
  
  // Puntuación inicial
  let score = 0;
  const feedback = [];
  
  // Verificar longitud mínima (6 caracteres)
  if (password.length < 6) {
    feedback.push('La contraseña debe tener al menos 6 caracteres');
    return { isValid: false, score, feedback };
  } else {
    score += Math.min(2, Math.floor(password.length / 5)); // Hasta 2 puntos por longitud
  }
  
  // Verificar variedad de caracteres
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[^a-zA-Z0-9]/.test(password);
  
  // Añadir puntos por cada tipo de caracter
  if (hasLowercase) score += 1;
  if (hasUppercase) score += 1;
  if (hasNumbers) score += 1;
  if (hasSpecialChars) score += 1;
  
  // Feedback sobre tipos de caracteres
  if (!hasLowercase && !hasUppercase) {
    feedback.push('Incluir letras mayúsculas y minúsculas aumenta la seguridad');
  }
  if (!hasNumbers) {
    feedback.push('Incluir números aumenta la seguridad');
  }
  if (!hasSpecialChars) {
    feedback.push('Incluir caracteres especiales aumenta la seguridad');
  }
  
  // Verificar si hay patrones comunes o palabras débiles
  const commonPatterns = [
    '123456', 'password', 'qwerty', 'abc123', 'admin', 'welcome',
    'password123', '12345678', '111111', 'iloveyou', 'letmein', 'monkey',
    'football', 'baseball', 'dragon', 'master'
  ];
  
  // Verificar si la contraseña contiene patrones comunes
  const lowercasePassword = password.toLowerCase();
  if (commonPatterns.some(pattern => lowercasePassword.includes(pattern))) {
    score = Math.max(0, score - 2); // Penalizar por patrones comunes
    feedback.push('La contraseña contiene patrones o palabras comunes');
  }
  
  // Verificar repeticiones
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1); // Penalizar por repeticiones
    feedback.push('Evitar repetir caracteres consecutivos');
  }
  
  // Verificar secuencias
  const sequences = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  for (const seq of sequences) {
    for (let i = 0; i < seq.length - 2; i++) {
      const snippet = seq.substring(i, i + 3);
      if (lowercasePassword.includes(snippet)) {
        score = Math.max(0, score - 1); // Penalizar por secuencias
        feedback.push('Evitar secuencias de caracteres comunes');
        break;
      }
    }
  }
  
  // Determinar validez basada en la puntuación
  const isValid = score >= 3;
  
  // Si es válida pero hay sugerencias, mantenerlas
  if (isValid && feedback.length > 0) {
    feedback.unshift('Contraseña aceptable, pero podría mejorar:');
  } else if (isValid) {
    feedback.push('Contraseña aceptable');
  } else {
    feedback.unshift('La contraseña es demasiado débil');
  }
  
  return {
    isValid,
    score,
    feedback
  };
}

/**
 * Genera una contraseña aleatoria segura
 * @param {number} length - Longitud de la contraseña (mínimo 8)
 * @param {Object} options - Opciones de generación
 * @returns {string} - Contraseña generada
 */
function generateRandomPassword(length = 12, options = {}) {
  const defaultOptions = {
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSpecialChars: true
  };
  
  // Combinar opciones predeterminadas con las proporcionadas
  const opts = { ...defaultOptions, ...options };
  
  // Asegurar una longitud mínima
  const passwordLength = Math.max(8, length);
  
  // Conjuntos de caracteres
  const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numberChars = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  // Construir conjunto de caracteres según opciones
  let chars = '';
  if (opts.includeLowercase) chars += lowerChars;
  if (opts.includeUppercase) chars += upperChars;
  if (opts.includeNumbers) chars += numberChars;
  if (opts.includeSpecialChars) chars += specialChars;
  
  // Si no se seleccionó ninguna opción, usar caracteres alfanuméricos
  if (!chars) {
    chars = lowerChars + upperChars + numberChars;
  }
  
  // Generar contraseña
  let password = '';
  
  // Asegurar al menos un caracter de cada tipo seleccionado
  if (opts.includeLowercase) {
    password += lowerChars.charAt(Math.floor(Math.random() * lowerChars.length));
  }
  if (opts.includeUppercase) {
    password += upperChars.charAt(Math.floor(Math.random() * upperChars.length));
  }
  if (opts.includeNumbers) {
    password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
  }
  if (opts.includeSpecialChars) {
    password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  }
  
  // Completar el resto de la contraseña
  for (let i = password.length; i < passwordLength; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Mezclar los caracteres para evitar patrones predecibles
  password = password.split('').sort(() => 0.5 - Math.random()).join('');
  
  return password;
}

/**
 * Verifica si un hash necesita ser actualizado (por ejemplo, si el factor de costo ha cambiado)
 * @param {string} hash - Hash de contraseña
 * @returns {boolean} - true si necesita actualización
 */
function needsRehash(hash) {
  if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
    return true; // No es un hash de bcrypt
  }
  
  // Extraer el número de rondas del hash
  const rounds = parseInt(hash.split('$')[2], 10);
  
  // Verificar si el número de rondas es menor que el configurado
  return rounds < SALT_ROUNDS;
}

module.exports = {
  generateHash,
  comparePassword,
  evaluateStrength,
  generateRandomPassword,
  needsRehash
};