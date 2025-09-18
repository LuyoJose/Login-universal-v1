// src/models/index.js
const User = require("./User");
const Role = require("./Role");
const Permission = require("./Permission");

// Relación muchos a muchos entre Role y Permission
Role.belongsToMany(Permission, { 
  through: 'RolePermissions',
  foreignKey: 'roleId'
});

Permission.belongsToMany(Role, { 
  through: 'RolePermissions',
  foreignKey: 'permissionId'
});

// Relación uno a muchos entre Role y User
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

module.exports = {
  User,
  Role,
  Permission
};