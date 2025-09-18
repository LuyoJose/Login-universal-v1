// src/middleware/checkPermission.js
const { RolePermission, Permission, Role } = require('../models');

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // ✅ NUEVA: Verificar permisos ESPECÍFICOS del usuario
      const userPermission = await RolePermission.findOne({
        where: { userId: req.user.userId },
        include: [{
          model: Permission,
          where: { name: requiredPermission },
          attributes: []
        }]
      });

      // ✅ OPCIÓN ALTERNATIVA: Verificar permisos del rol (como antes)
      const userRole = await Role.findByPk(req.user.roleId, {
        include: [{
          model: Permission,
          through: { attributes: [] }
        }]
      });

      // ✅ Verificar SI el usuario tiene el permiso específico O si su rol lo tiene
      const hasSpecificPermission = !!userPermission;
      const hasRolePermission = userRole && userRole.Permissions.some(
        permission => permission.name === requiredPermission
      );

      const hasPermission = hasSpecificPermission || hasRolePermission;

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Permiso denegado',
          required: requiredPermission,
          userId: req.user.userId,
          // Opcional: mostrar qué permisos tiene
          userPermissions: userRole ? userRole.Permissions.map(p => p.name) : []
        });
      }

      next();
    } catch (error) {
      console.error('Error en checkPermission:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
};

module.exports = { checkPermission };