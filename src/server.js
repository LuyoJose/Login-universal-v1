const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectRedis } = require('./utils/redis');
const { connectDB } = require('./utils/db');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protectedRoutes');
const { initPermissions } = require('./utils/initPermissions');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);

// Middleware de errores
app.use((err, req, res, next) => {
  console.error('Error detallado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Conectado a PostgreSQL y tablas sincronizadas");

    await initPermissions();
    console.log("✅ Permisos y roles inicializados");

    await connectRedis();
    console.log("✅ Conectado a Redis");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
  } catch (error) {
    console.error("❌ Error al iniciar servidor:", error);
    process.exit(1);
  }
};

startServer();
