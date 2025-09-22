const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../utils/db");

class Role extends Model { }

Role.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Role",
    tableName: "roles",
  }
);

  // 🔹 Asociaciones
Role.associate = (models) => {
    Role.hasMany(models.User, { foreignKey: "roleId" });
  };

module.exports = Role;