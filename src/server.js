const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectRedis } = require('./utils/redis');
const { connectDB } = require('./utils/db');
const authRoutes = require('./routes/auth');
const { initPermissions } = require('./utils/initPermissions');
const logger = require('./utils/logger'); // 👈 importar tu logger

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);

// Middleware de errores
app.use((err, req, res, next) => {
  logger.error('Error detallado:', err); // 👈 usar logger
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const startServer = async () => {
  try {
    await connectDB();
    logger.info("✅ Conectado a PostgreSQL y tablas sincronizadas");

    await initPermissions();
    logger.info("✅ Permisos y roles inicializados");

    await connectRedis();
    logger.info("✅ Conectado a Redis");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => logger.info(`🚀 Servidor corriendo en http://localhost:${PORT}`));
  } catch (error) {
    logger.error("❌ Error al iniciar servidor:", error);
    process.exit(1);
  }
};

startServer();
