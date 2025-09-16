// src/models/User.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../utils/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [8, 255] },  // Mínimo 8 chars
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),  // Como en diagrama: roles para guards
    defaultValue: 'user',
    allowNull: false,
  },
}, {
  hooks: {  // Auto-hash password al crear/actualizar
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

// Método para comparar password (usa en login)
User.prototype.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;