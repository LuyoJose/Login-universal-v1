// src/utils/initPermissions.js
const { Role, Permission } = require('../models');

const initPermissions = async () => {
    try {
        // Crear permisos
        const permissions = await Permission.bulkCreate([
            { name: 'read', description: 'Permiso de lectura' },
            { name: 'write', description: 'Permiso de escritura' },
            { name: 'edit', description: 'Permiso de edición' },
            { name: 'delete', description: 'Permiso de eliminación' }
        ], { ignoreDuplicates: true });

        // Crear roles
        const [adminRole, managerRole, userRole] = await Role.bulkCreate([
            { name: 'admin', description: 'Administrador con todos los permisos' },
            { name: 'manager', description: 'Manager con permisos de lectura y escritura' },
            { name: 'user', description: 'Usuario con permisos de lectura' }
        ], { ignoreDuplicates: true });

        // Asignar permisos a roles
        await adminRole.setPermissions(permissions); // Todos los permisos

        await managerRole.setPermissions([
            permissions.find(p => p.name === 'read'),
            permissions.find(p => p.name === 'write')
        ]);

        await userRole.setPermissions([
            permissions.find(p => p.name === 'read')
        ]);

        console.log('Permisos y roles inicializados correctamente');
    } catch (error) {
        console.error('Error inicializando permisos:', error);
    }
};

module.exports = { initPermissions };