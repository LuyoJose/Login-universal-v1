// src/middleware/checkPermission.js
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../utils/redis');
const config = require('../config');
const { Role, User, Permission } = require('../models');
const logger = require('../utils/logger');

const checkPermission = (requiredPermission = null) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        logger.warn('❌ Token requerido pero ausente', { path: req.originalUrl, ip: req.ip });
        return res.status(401).json({ error: 'Token requerido' });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch (err) {
        logger.warn('⚠️ Token inválido o expirado', { token, ip: req.ip });
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }

      const redis = await connectRedis();
      const savedToken = await redis.get(`token:${decoded.userId}`);
      if (savedToken !== token) {
        logger.warn('⚠️ Token no coincide en Redis', { userId: decoded.userId });
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }

      const user = await User.findByPk(decoded.userId, {
        include: {
          model: Role,
          as: 'role',
          include: {
            model: Permission,
            as: 'permissions',
            through: { attributes: [] },
          },
        },
      });

      if (!user) {
        logger.warn('❌ Usuario no encontrado en DB', { userId: decoded.userId });
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }

      req.user = {
        id: user.id,
        email: user.credential?.email || null,
        role: user.role?.name || 'sin rol',
        roleId: user.roleId,
        permissions: user.role?.permissions.map((p) => p.name) || [],
      };

      if (requiredPermission && !req.user.permissions.includes(requiredPermission)) {
        logger.warn('🚫 Permiso denegado', {
          userId: req.user.id,
          requiredPermission,
          currentPermissions: req.user.permissions,
        });

        return res.status(403).json({
          error: 'Permiso denegado',
          required: requiredPermission,
          userId: req.user.id,
        });
      }

      logger.info('✅ Permiso OK', { userId: req.user.id, requiredPermission });
      next();
    } catch (error) {
      logger.error('❌ Error en checkPermission', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
};

module.exports = { checkPermission };
