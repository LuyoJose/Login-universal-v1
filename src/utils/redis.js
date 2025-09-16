const { createClient } = require('redis');
const config = require('../config');

const client = createClient({
  url: config.redisUrl,
});

client.on('error', (err) => console.error('Redis error:', err));

// Conecta al conectar el server
let isConnected = false;
async function connectRedis() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log('Redis conectado');
  }
  return client;
}

module.exports = { connectRedis, client };