// src/models/RolePermission.js (nuevo archivo)
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../utils/db");

class RolePermission extends Model { }

RolePermission.init(
    {
        roleId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'roles',
                key: 'id'
            }
        },
        permissionId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'permissions',
                key: 'id'
            }
        },
        userId: {
            type: DataTypes.UUID,
            primaryKey: true, // o allowNull: false si no es parte de la PK
            references: {
                model: 'users',
                key: 'id'
            }
        }
    },
    {
        sequelize,
        modelName: "RolePermission",
        tableName: "RolePermissions",
        timestamps: true, // Para createdAt y updatedAt
    }
);

module.exports = RolePermission;