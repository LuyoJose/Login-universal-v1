// src/models/User.js (actualizado)
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../utils/db");
const Role = require("./Role");

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    },
    apellido: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
  }
);

User.associate = (models) => {
  User.belongsTo(models.Role, { foreignKey: "roleId" }); // muchos usuarios → un rol
  User.hasOne(models.Credential, { foreignKey: "userId", onDelete: "CASCADE" }); // un user → una credencial
};

module.exports = User;