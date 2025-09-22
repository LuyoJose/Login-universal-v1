// src/middleware/checkPermission.js
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../utils/redis');
const config = require('../config');
const { Role, User, Permission } = require('../models');

const checkPermission = (requiredPermission = null) => {
  return async (req, res, next) => {
    try {
      // 1️⃣ Verificar token en headers
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Token requerido' });

      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }

      // 2️⃣ Verificar token en Redis
      const redis = await connectRedis();
      const savedToken = await redis.get(`token:${decoded.userId}`);
      if (savedToken !== token) return res.status(401).json({ error: 'Token inválido o expirado' });

      // 3️⃣ Obtener usuario con su rol y permisos
      const user = await User.findByPk(decoded.userId, {
        include: {
          model: Role,
          as: "role",   // 👈 alias correcto
          include: {
            model: Permission,
            as: "permissions", // 👈 alias correcto
            through: { attributes: [] }
          }
        }
      });


      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      req.user = {
        id: user.id,
        email: user.credential?.email || null,
        role: user.role?.name || "sin rol",
        roleId: user.roleId,
        permissions: user.role?.permissions.map((p) => p.name) || [],
      };

      // 4️⃣ Validar permiso si se requiere
      if (requiredPermission && !req.user.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          error: 'Permiso denegado',
          required: requiredPermission,
          userId: req.user.id,
          userPermissions: req.user.permissions
        });
      }

      next(); // Todo OK
    } catch (error) {
      console.error('Error en checkPermission:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
};

module.exports = { checkPermission };
