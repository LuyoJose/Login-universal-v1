const { sequelize } = require("../utils/db");
const User = require("./User");
const Role = require("./Role");
const Permission = require("./Permission");

// Relaciones
Role.hasMany(User, { foreignKey: "roleId" });
User.belongsTo(Role, { foreignKey: "roleId" });

Role.belongsToMany(Permission, { through: "RolePermissions" });
Permission.belongsToMany(Role, { through: "RolePermissions" });

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
};
