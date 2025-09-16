// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectRedis } = require('./utils/redis');
const { sequelize } = require('./models'); // 👈 aquí traes sequelize y modelos
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protectedRoutes');
const { createTestUser } = require('./controllers/authController');

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
  console.error(err);
  res.status(500).json({ error: 'Algo salió mal' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado a PostgreSQL");
    await sequelize.sync({ alter: true }); // ⚠️ solo en dev
    console.log("✅ Tablas sincronizadas");

    await createTestUser(); // Crea usuario de prueba
    await connectRedis();

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
