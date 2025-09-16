require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  redisUrl: process.env.REDIS_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbName: process.env.DB_NAME,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbHost: process.env.DB_HOST,
  dbPort: process.env.DB_PORT,
};

// Validación básica (mejor práctica: falla temprano)
if (!config.jwtSecret || !config.redisUrl) {
  throw new Error('Faltan vars en .env: JWT_SECRET o REDIS_URL');
}

module.exports = config;