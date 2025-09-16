// src/utils/db.js
const { Sequelize } = require('sequelize');
const config = require('../config');

// Crea instancia Sequelize
const sequelize = new Sequelize(
  config.dbName || process.env.DB_NAME,
  config.dbUser || process.env.DB_USER,
  config.dbPassword || process.env.DB_PASSWORD,
  {
    host: config.dbHost || process.env.DB_HOST,
    port: config.dbPort || process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: config.nodeEnv === 'development' ? console.log : false,  // Logs queries en dev
    pool: {  // Pool de conexiones para performance
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Prueba conexión
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL conectado');
    await sequelize.sync();  // Crea tablas auto si no existen (dev only; usa migraciones en prod)
  } catch (error) {
    console.error('Error conectando DB:', error);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };