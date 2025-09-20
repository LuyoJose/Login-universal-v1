const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Credential, User, Role, RolePermission, Permission } = require('../src/models'); // ajusta la ruta si es necesario

(async () => {
    try {
        const superAdminEmail = 'superadmin@example.com';

        // Buscar credencial
        let credential = await Credential.findOne({ where: { email: superAdminEmail }, include: [{ model: User, as: 'user' }] });

        if (!credential) {
            console.log('No se encontró superadmin. Por favor ejecuta initPermissions primero.');
            process.exit(0);
        }

        // Generar nuevo hash
        const newHash = await bcrypt.hash('SuperAdmin123!', 10);

        // Actualizar la contraseña en la DB
        await credential.update({ password: newHash.trim() });

        console.log('✅ Contraseña del superadmin re-hasheada correctamente.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error al regenerar contraseña:', error);
        process.exit(1);
    }
})();
