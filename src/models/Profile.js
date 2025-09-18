// src/models/Profile.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../utils/db");

class Profile extends Model { }

Profile.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        nombre: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        apellido: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        avatar: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
    },
    {
        sequelize,
        modelName: "Profile",
        tableName: "profiles",
    }
);

module.exports = Profile;