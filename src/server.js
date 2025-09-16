// src/server.js (actualizado)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectRedis } = require('./utils/redis');
const { connectDB } = require('./utils/db');  // Nueva
const config = require('./config');
const authRoutes = require('./routes/auth');
const { createTestUser } = require('./controllers/authController');  // Para dev

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Algo salió mal' });
});

const startServer = async () => {
  await connectDB();  // Nueva: Conecta Postgres
  await createTestUser();  // Crea user test si no existe
  await connectRedis();
  app.listen(config.port, () => {
    console.log(`Server en http://localhost:${config.port}`);
  });
};

startServer();