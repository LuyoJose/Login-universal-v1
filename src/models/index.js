// src/models/index.js
const User = require("./User");
const Role = require("./Role");
const Permission = require("./Permission");
const RolePermission = require("./RolePermission");
const Credential = require("./Credential"); // ← FALTABA ESTA IMPORTACIÓN

// Relaciones de Credential (DEBEN estar después de importar Credential)
User.hasOne(Credential, { 
  foreignKey: 'userId', 
  onDelete: 'CASCADE',
  as: 'credential'
});
Credential.belongsTo(User, { 
  foreignKey: 'userId',
  as: 'user'
});

// Relaciones de RolePermission
RolePermission.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(RolePermission, { foreignKey: 'userId' });

RolePermission.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(RolePermission, { foreignKey: 'roleId' });

RolePermission.belongsTo(Permission, { foreignKey: 'permissionId' });
Permission.hasMany(RolePermission, { foreignKey: 'permissionId' });

// Relación muchos a muchos entre Role y Permission
Role.belongsToMany(Permission, { 
  through: RolePermission,
  foreignKey: 'roleId',
  otherKey: 'permissionId'
});

Permission.belongsToMany(Role, { 
  through: RolePermission,
  foreignKey: 'permissionId',
  otherKey: 'roleId'
});

// Relación usuario-rol
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

// Exportar TODOS los modelos
module.exports = {
  User,
  Role,
  Permission,
  RolePermission,
  Credential // ← Exportar Credential también
};