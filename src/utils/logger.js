const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, colorize } = format;

// formato personalizado
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
    level: "info", // nivel mínimo de logs (puedes cambiar a debug en dev)
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }), // muestra stack en errores
        logFormat
    ),
    transports: [
        // consola con colores
        new transports.Console({
            format: combine(colorize(), logFormat),
        }),
        // archivo general
        new transports.File({ filename: "logs/app.log" }),
        // archivo solo errores
        new transports.File({ filename: "logs/error.log", level: "error" }),
    ],
});

module.exports = logger;
