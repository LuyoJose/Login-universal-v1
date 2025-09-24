const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('./logger'); // 👈 importa tu logger

// Crea instancia Sequelize
const sequelize = new Sequelize(
  config.dbName || process.env.DB_NAME,
  config.dbUser || process.env.DB_USER,
  config.dbPassword || process.env.DB_PASSWORD,
  {
    host: config.dbHost || process.env.DB_HOST,
    port: config.dbPort || process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: config.nodeEnv === 'development' ? (msg) => logger.debug(msg) : false,  // 👈 usa logger en dev
    pool: {
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
    logger.info('✅ PostgreSQL conectado');

    // ⚠️ SOLO EN DESARROLLO: { alter: true } para actualizar esquemas
    const syncOptions = process.env.NODE_ENV === 'production' ? {} : { alter: true };
    await sequelize.sync(syncOptions);

    logger.info('✅ Tablas sincronizadas');
  } catch (error) {
    logger.error('❌ Error conectando DB:', error);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
