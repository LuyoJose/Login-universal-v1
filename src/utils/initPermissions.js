// src/utils/initPermissions.js
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs'); // Asegúrate de instalar: npm i bcryptjs
const { Role, Permission, User, Credential, RolePermission } = require('../models');

const initPermissions = async () => {
    try {
        // 1) Permisos base
        const perms = [
            'read',
            'write',
            'edit',
            'delete',
            'manage_roles',
            'manage_permissions',
            'super_admin' // permiso especial
        ];

        const permissionRecords = await Promise.all(
            perms.map(async (name) => {
                const [perm] = await Permission.findOrCreate({
                    where: { name },
                    defaults: { id: uuidv4(), name, description: `Permiso ${name}` }
                });
                return perm;
            })
        );

        // 2) Roles (añadí manager)
        const roles = [
            { name: 'superadmin', description: 'Super Administrador con acceso total' },
            { name: 'admin', description: 'Administrador con permisos avanzados' },
            { name: 'manager', description: 'Manager con permisos de lectura y escritura' },
            { name: 'user', description: 'Usuario con permisos básicos' }
        ];

        const roleRecords = await Promise.all(
            roles.map(async (r) => {
                const [role] = await Role.findOrCreate({
                    where: { name: r.name },
                    defaults: { id: uuidv4(), name: r.name, description: r.description }
                });
                return role;
            })
        );

        const superAdminRole = roleRecords.find(r => r.name === 'superadmin');
        const adminRole = roleRecords.find(r => r.name === 'admin');
        const managerRole = roleRecords.find(r => r.name === 'manager');
        const userRole = roleRecords.find(r => r.name === 'user');

        // 3) Crear/buscar superusuario (lo hacemos por Credential para no asumir columna email en User)
        const superAdminEmail = 'superadmin@example.com';
        let credential = await Credential.findOne({
            where: { email: superAdminEmail },
            include: { model: User, as: 'user' } // usa el alias si en tus modelos definiste 'as'
        });

        let superUser;
        if (!credential) {
            // crear usuario primero (roleId ya existe porque creamos roles antes)
            superUser = await User.create({
                id: uuidv4(),
                nombre: 'Super',
                apellido: 'Admin',
                roleId: superAdminRole.id,
                status: 'active'
            });

            // crear credencial con password hasheada
            const hashed = await bcrypt.hash('SuperAdmin123!', 10); // cambia contraseña si quieres
            credential = await Credential.create({
                id: uuidv4(),
                email: superAdminEmail,
                password: hashed,
                userId: superUser.id,
                isVerified: true
            });

            console.log('🎉 Superadmin creado:', superAdminEmail, '(pwd encriptada)');
        } else {
            superUser = credential.user;
            console.log('ℹ️ Superadmin ya existe en la DB:', superAdminEmail);
        }

        // 4) Asignar permisos en RolePermission
        // IMPORTANTE: tu tabla RolePermissions exige userId NOT NULL (según errores anteriores).
        // Por eso asigno userId = superUser.id a las filas "globales". Si quieres permitir userId NULL,
        // modifica tu modelo/DB para permitir NULL y entonces podrías usar userId: null para permisos globales.

        // Superadmin: todos los permisos (y los vinculo al superUser como "owner" para cumplir NOT NULL)
        await Promise.all(permissionRecords.map(async (perm) => {
            await RolePermission.findOrCreate({
                where: { roleId: superAdminRole.id, permissionId: perm.id, userId: superUser.id },
                defaults: { id: uuidv4(), roleId: superAdminRole.id, permissionId: perm.id, userId: superUser.id }
            });
        }));

        // Admin: todos menos 'super_admin' (asignados con userId = superUser.id para evitar NOT NULL)
        await Promise.all(
            permissionRecords
                .filter(p => p.name !== 'super_admin')
                .map(async (perm) => {
                    await RolePermission.findOrCreate({
                        where: { roleId: adminRole.id, permissionId: perm.id, userId: superUser.id },
                        defaults: { id: uuidv4(), roleId: adminRole.id, permissionId: perm.id, userId: superUser.id }
                    });
                })
        );

        // Manager: solo read + write (puedes agregar otros si quieres)
        await Promise.all(
            permissionRecords
                .filter(p => ['read', 'write'].includes(p.name))
                .map(async (perm) => {
                    await RolePermission.findOrCreate({
                        where: { roleId: managerRole.id, permissionId: perm.id, userId: superUser.id },
                        defaults: { id: uuidv4(), roleId: managerRole.id, permissionId: perm.id, userId: superUser.id }
                    });
                })
        );

        // User: solo read
        await Promise.all(
            permissionRecords
                .filter(p => p.name === 'read')
                .map(async (perm) => {
                    await RolePermission.findOrCreate({
                        where: { roleId: userRole.id, permissionId: perm.id, userId: superUser.id },
                        defaults: { id: uuidv4(), roleId: userRole.id, permissionId: perm.id, userId: superUser.id }
                    });
                })
        );

        console.log('✅ Permisos, roles y superusuario inicializados correctamente');
    } catch (error) {
        console.error('❌ Error inicializando permisos:', error);
    }
};

module.exports = { initPermissions };