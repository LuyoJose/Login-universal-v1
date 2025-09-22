// src/models/Credential.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../utils/db");
const User = require("./User");

class Credential extends Model { }

Credential.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
            validate: { isEmail: true },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "Credential",
        tableName: "credentials",
        hooks: {
            beforeCreate: async (credential) => {
                if (credential.password) {
                    const bcrypt = require('bcrypt');
                    credential.password = await bcrypt.hash(credential.password, 10);
                }
            },
        },
    }
);

// 🔹 Asociaciones
Credential.associate = (models) => {
    Credential.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE" });
};
// Método para comparar passwords
Credential.prototype.comparePassword = async function (password) {
    const bcrypt = require('bcrypt');
    return bcrypt.compare(password, this.password);
};

module.exports = Credential;