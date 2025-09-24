// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      logger.warn('❌ No token en request', { ip: req.ip, path: req.originalUrl });
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const redis = await connectRedis();
    const savedToken = await redis.get(`token:${decoded.userId}`);
    if (savedToken !== token) {
      logger.warn('⚠️ Token inválido detectado', { userId: decoded.userId, ip: req.ip });
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = {
      id: decoded.userId,
      role: decoded.role,
      roleId: decoded.roleId,
      sessionId: decoded.sessionId,
    };

    logger.info('✅ Auth OK', { userId: decoded.userId, role: decoded.role });
    next();
  } catch (error) {
    logger.error('❌ Auth middleware error', { error: error.message, stack: error.stack });
    res.status(401).json({ error: 'Auth failed' });
  }
};
