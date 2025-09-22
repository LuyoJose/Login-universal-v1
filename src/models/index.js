// src/models/index.js
const User = require("./User");
const Role = require("./Role");
const Permission = require("./Permission");
const RolePermission = require("./RolePermission");
const Credential = require("./Credential");

// Relación User ↔ Credential (1:1)
User.hasOne(Credential, {
  foreignKey: "userId",
  onDelete: "CASCADE",
  as: "credential",
});
Credential.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// Relación User ↔ Role (1:N)
Role.hasMany(User, {
  foreignKey: "roleId",
  as: "users",
});
User.belongsTo(Role, {
  foreignKey: "roleId",
  as: "role",
});

// Relación Role ↔ Permission (N:N) a través de RolePermission
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "roleId",
  otherKey: "permissionId",
  as: "permissions",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permissionId",
  otherKey: "roleId",
  as: "roles",
});

// Exportar modelos
module.exports = {
  User,
  Role,
  Permission,
  RolePermission,
  Credential,
};
