// src/middleware/checkPermission.js
const { Role, Permission } = require('../models');

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Obtener el rol del usuario con sus permisos
      const userRole = await Role.findByPk(req.user.roleId, {
        include: [{
          model: Permission,
          through: { attributes: [] } // Excluir tabla intermedia
        }]
      });

      if (!userRole) {
        return res.status(403).json({ error: 'Rol no encontrado' });
      }

      // Verificar si el rol tiene el permiso requerido
      const hasPermission = userRole.Permissions.some(
        permission => permission.name === requiredPermission
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Permiso denegado',
          required: requiredPermission,
          has: userRole.Permissions.map(p => p.name)
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