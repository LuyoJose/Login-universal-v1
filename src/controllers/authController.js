// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require('uuid');
const { connectRedis } = require('../utils/redis');
const { User, Role, Credential, Permission, RolePermission } = require('../models');
const { sequelize } = require('../utils/db');
const config = require('../config');

// ---------------------------------------------------
// Función para asignar permisos por defecto
async function assignDefaultPermissions(userId, roleName) {
  try {
    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) return;

    const defaultPermissions = {
      'superadmin': ['read', 'write', 'edit', 'delete', 'manage_permissions', 'manage_roles', 'super_admin'],
      'admin': ['read', 'write', 'edit', 'delete', 'manage_permissions'],
      'manager': ['read', 'write'],
      'user': ['read']
    };

    const permissionsToAssign = defaultPermissions[roleName] || ['read'];

    for (const permName of permissionsToAssign) {
      const permission = await Permission.findOne({ where: { name: permName } });
      if (permission) {
        await RolePermission.create({
          roleId: role.id,
          permissionId: permission.id,
          userId: userId
        });
      }
    }

    console.log(`✅ Permisos asignados para usuario ${userId} con rol ${roleName}`);
  } catch (error) {
    console.error('❌ Error asignando permisos por defecto:', error);
  }
}

// ---------------------------------------------------
// Middleware para superadmin
exports.isSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Role,
        as: 'role',
        include: [{
          model: Permission,
          as: 'permissions'
        }]
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Acceso correcto a role → permissions
    const hasSuperAdminPermission = user.role?.permissions?.some(
      (p) => p.name === 'super_admin'
    );

    if (!hasSuperAdminPermission) {
      return res.status(403).json({ error: 'Se requieren permisos de superadministrador' });
    }

    next();
  } catch (error) {
    console.error('Error verificando superadmin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


// ---------------------------------------------------
// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email y password requeridos" });
    }

    // Buscar credencial + usuario + rol
    const credential = await Credential.findOne({
      where: { email },
      include: [{ model: User, as: "user", include: [{ model: Role, as: "role" }] }]
    });

    if (!credential) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Usar método del modelo
    const validPassword = await credential.comparePassword(password);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Actualizar último login
    await credential.update({ lastLogin: new Date() });

    const user = credential.user;
    const userRole = user.role;

    // Crear sesión y token
    const sessionId = `session_${uuidv4().replace(/-/g, "")}`;
    const token = jwt.sign(
      {
        userId: user.id,
        role: userRole?.name || "user",
        roleId: user.roleId,
        sessionId,
      },
      config.jwtSecret,
      { expiresIn: "1h" }
    );

    const redis = await connectRedis();
    const sessionData = {
      session: {
        token,
        user: {
          email: credential.email,
          nombre: user.nombre,
          apellido: user.apellido,
          role: userRole?.name,
        },
      },
    };

    // Guardar token en Redis
    await redis.set(`token:${user.id}`, token, { EX: 3600 });
    await redis.set(sessionId, JSON.stringify(sessionData), { EX: 3600 });
    await redis.set(`user:${user.id}:session`, sessionId, { EX: 3600 });

    res.json({
      message: "Login OK",
      sessionId,
      token,
      user: {
        id: user.id,
        email: credential.email,
        role: userRole?.name,
        nombre: user.nombre,
        apellido: user.apellido,
      },
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
};

// ---------------------------------------------------
// Register (solo superadmin)
exports.register = async (req, res) => {
  try {
    const { nombre, apellido, email, password, role } = req.body;

    if (!nombre || !apellido || !email || !password || !role) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si el email ya existe
    const existingCredential = await Credential.findOne({ where: { email } });
    if (existingCredential) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    // Validar rol
    const roleObj = await Role.findOne({ where: { name: role } });
    if (!roleObj) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Crear usuario
    const userId = uuidv4();
    const newUser = await User.create({
      id: userId,
      nombre,
      apellido,
      roleId: roleObj.id,
      status: 'active'
    });

    // Crear credencial (password en texto plano, Sequelize lo hashea con el hook)
    await Credential.create({
      email,
      password, // sin hash aquí
      userId: newUser.id,
      isVerified: true,
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: newUser.id,
        nombre: newUser.nombre,
        apellido: newUser.apellido,
        role: roleObj.name
      }
    });
  } catch (error) {
    console.error('Error en register:', error.message, error.stack);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

// ---------------------------------------------------
// Gestión de roles
exports.assignRoleToUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { userId, roleName } = req.body;
    if (!userId || !roleName) return res.status(400).json({ error: 'userId y roleName requeridos' });

    const targetUser = await User.findByPk(userId, { include: [Role], transaction });
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    const targetIsSuperAdmin = targetUser.Role.Permissions?.some(p => p.name === 'super_admin');
    if (targetIsSuperAdmin) return res.status(403).json({ error: 'No puedes modificar roles de otros superadministradores' });

    const newRole = await Role.findOne({ where: { name: roleName }, include: [Permission], transaction });
    if (!newRole) return res.status(404).json({ error: 'Rol no encontrado' });

    const newRoleIsSuperAdmin = newRole.Permissions.some(p => p.name === 'super_admin');
    if (newRoleIsSuperAdmin) return res.status(403).json({ error: 'Solo superadministradores pueden asignar este rol' });

    await targetUser.update({ roleId: newRole.id }, { transaction });
    await transaction.commit();

    res.json({ message: 'Rol asignado correctamente', user: { id: targetUser.id, newRole: newRole.name } });
  } catch (error) {
    await transaction.rollback();
    console.error('Error asignando rol:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.removeRoleFromUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    const targetUser = await User.findByPk(userId, { include: [Role], transaction });
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    const targetIsSuperAdmin = targetUser.Role.Permissions?.some(p => p.name === 'super_admin');
    if (targetIsSuperAdmin) return res.status(403).json({ error: 'No puedes modificar roles de otros superadministradores' });

    const defaultRole = await Role.findOne({ where: { name: 'user' }, transaction });
    if (!defaultRole) return res.status(404).json({ error: 'Rol por defecto no configurado' });

    await targetUser.update({ roleId: defaultRole.id }, { transaction });
    await transaction.commit();

    res.json({ message: 'Rol removido, asignado rol por defecto', user: { id: targetUser.id, newRole: 'user' } });
  } catch (error) {
    await transaction.rollback();
    console.error('Error removiendo rol:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ---------------------------------------------------
// Obtener usuarios y roles
exports.getUsersWithRoles = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'nombre', 'apellido', 'status'],
      include: [
        { model: Credential, attributes: ['email'] },
        { model: Role, attributes: ['name', 'description'] }
      ],
      order: [['id', 'ASC']]
    });

    res.json({
      users: users.map(u => ({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.Credential?.email,
        role: u.Role?.name || 'sin rol',
        status: u.status
      }))
    });
  } catch (error) {
    console.error('Error obteniendo usuarios con roles:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

exports.getAvailableRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({ attributes: ['id', 'name', 'description'], order: [['name', 'ASC']] });
    res.json({ roles: roles.map(role => ({ name: role.name, description: role.description })) });
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

// ---------------------------------------------------
// Crear usuario de prueba
exports.createTestUser = async () => {
  try {
    const existing = await Credential.findOne({
      where: { email: 'test@example.com' },
      include: [{ model: User, as: "user" }]
    });

    if (!existing) {
      const userRole = await Role.findOne({ where: { name: 'admin' } });
      const user = await User.create({ nombre: 'Test', apellido: 'User', roleId: userRole.id, status: 'active' });
      await Credential.create({ email: 'test@example.com', password: 'password123', userId: user.id, isVerified: true });
      await assignDefaultPermissions(user.id, 'admin');
      console.log('✅ User de prueba creado');
    }
  } catch (error) {
    console.error('Error creando user test:', error);
  }
};
