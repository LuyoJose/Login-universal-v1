const { DataTypes } = require("sequelize");
const { sequelize } = require("../utils/db");

const Permission = sequelize.define("Permission", {
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = Permission;
