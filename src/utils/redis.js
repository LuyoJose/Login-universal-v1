const { createClient } = require('redis');
const config = require('../config');
const logger = require('./logger'); // 👈 importa logger

const client = createClient({
  url: config.redisUrl,
});

client.on('error', (err) => logger.error('❌ Redis error:', err));

// Conecta al iniciar el server
let isConnected = false;
async function connectRedis() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      logger.info('✅ Redis conectado');
    } catch (err) {
      logger.error('❌ Error conectando a Redis:', err);
      throw err;
    }
  }
  return client;
}

module.exports = { connectRedis, client };
