const roles = require('../config/roles');

function checkPermission(permission) {
  return (req, res, next) => {
    const userRole = req.user.role; // viene del token decodificado en auth.js
    const allowed = roles[userRole] || [];

    if (allowed.includes('*') || allowed.includes(permission)) {
      return next();
    }
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  };
}

module.exports = checkPermission;
