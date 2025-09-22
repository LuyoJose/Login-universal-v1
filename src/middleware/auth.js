// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../utils/redis');
const config = require('../config');

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, config.jwtSecret);
    const redis = await connectRedis();
    const savedToken = await redis.get(`token:${decoded.userId}`);
    if (savedToken !== token) return res.status(401).json({ error: 'Token inválido' });

    // 🔑 Normalizamos el objeto req.user
    req.user = {
      id: decoded.userId,       // estandarizamos a .id
      role: decoded.role,
      roleId: decoded.roleId,
      sessionId: decoded.sessionId
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: 'Auth failed' });
  }
};
