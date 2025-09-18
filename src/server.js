// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectRedis } = require('./utils/redis');
const { connectDB, sequelize } = require('./utils/db'); // ← Importa connectDB y sequelize
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protectedRoutes');
const { createTestUser } = require('./controllers/authController');
const { initPermissions } = require('./utils/initPermissions');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api', protectedRoutes);

// Middleware de errores
app.use((err, req, res, next) => {
  console.error('Error detallado:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: err.message, // ← Muestra el mensaje específico
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const startServer = async () => {
  try {
    // Usa connectDB en lugar de authenticate manual
    await connectDB(); // ← Esta función ya incluye authenticate() y sync()
    console.log("✅ Conectado a PostgreSQL y tablas sincronizadas");

    // Inicializa permisos y roles
    await initPermissions();
    console.log("✅ Permisos y roles inicializados");

    // Crea usuario de prueba
    await createTestUser();
    console.log("✅ Usuario de prueba creado");

    // Conecta a Redis
    await connectRedis();
    console.log("✅ Conectado a Redis");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar servidor:", error);
    process.exit(1);
  }
};

startServer();