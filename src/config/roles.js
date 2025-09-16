// src/config/roles.js
const roles = {
  user: [
    'read:profile',
    'update:profile',
  ],
  manager: [
    'read:profile',
    'update:profile',
    'create:order',
    'view:orders',
  ],
  admin: [
    '*', // Admin tiene todos los permisos
  ],
};

module.exports = roles;
