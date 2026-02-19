const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');

// Crear el directorio de logs si no existe
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: 'info',
  // Formato JSON para facilitar el análisis posterior
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }), // Para incluir el stack trace en los errores
    winston.format.json()
  ),
  defaultMeta: { service: 'mr-letreros-api' },
  transports: [
    // Guardar errores críticos en un archivo separado 'error.log'
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    // Guardar todos los logs (info y superiores) en 'combined.log'
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
});

// Si no estamos en producción, también mostrar los logs en la consola
// con un formato más simple y legible.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

module.exports = logger;