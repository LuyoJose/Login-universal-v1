// src/controllers/authController.js (actualizado)
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../utils/redis');
const config = require('../config');
const { User, Role, Credential } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { RolePermission, Permission } = require('../models');
const { sequelize } = require('../utils/db');

async function assignDefaultPermissions(userId, roleName) {
  try {
    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) return;

    // Permisos por defecto según el rol
    const defaultPermissions = {
      'admin': ['read', 'write', 'edit', 'delete', 'manage_permissions'], // ← Agregar manage_permissions
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
    
    console.log(`Permisos asignados para usuario ${userId} con rol ${roleName}`);
  } catch (error) {
    console.error('Error asignando permisos por defecto:', error);
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y password requeridos' });

    // Buscar en Credentials
    const credential = await Credential.findOne({ 
      where: { email },
      include: [{
        model: User,
        include: [Role]
      }]
    });

    if (!credential || !(await credential.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Actualizar último login
    await credential.update({ lastLogin: new Date() });

    const user = credential.User;
    const userRole = user.Role;

    // Generar session_id único
    const sessionId = `session_${uuidv4().replace(/-/g, '')}`;
    
    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        role: userRole.name,
        roleId: user.roleId,
        sessionId: sessionId
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Guardar en Redis
    const redis = await connectRedis();
    
    const sessionData = {
      "session": {
        "token": token,
        "user": {
          "role": userRole.name,
          "email": credential.email,
          "nombre": user.nombre,
          "apellido": user.apellido
        }
      }
    };

    await redis.set(sessionId, JSON.stringify(sessionData), { 
      EX: 3600
    });

    await redis.set(`user:${user.id}:session`, sessionId, { EX: 3600 });

    res.json({ 
      message: "Login OK",
      sessionId: sessionId,
      token: token,
      user: {
        id: user.id,
        email: credential.email,
        role: userRole.name,
        nombre: user.nombre,
        apellido: user.apellido
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno', details: error.message });
  }
};


exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    const decoded = jwt.verify(token, config.jwtSecret);

    // Chequea en Redis
    const redis = await connectRedis();
    const savedToken = await redis.get(`token:${decoded.userId}`);
    if (savedToken !== token) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Opcional: Refresh user de DB para datos frescos
    const user = await User.findByPk(decoded.userId, { attributes: ['id', 'email', 'role'] });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    req.user = { ...decoded, email: user.email };  // Merge con DB
    res.json({ message: 'Token válido', user: req.user });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Nueva ruta: Registro (para crear users con roles)
// EN authController.js - CAMBIA la búsqueda del registro
exports.register = async (req, res) => {
  let roleRecord;
  
  // ✅ Asegúrate de tener esta importación al inicio del archivo:
  // const { sequelize } = require('../utils/db');
  const transaction = await sequelize.transaction();

  try {
    const { email, password, role, nombre, apellido } = req.body;
    
    if (!email || !password) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Email y password requeridos' });
    }

    // Buscar en CREDENTIALS
    const existingCredential = await Credential.findOne({
      where: { email },
      transaction
    });

    if (existingCredential) {
      await transaction.rollback();
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    roleRecord = await Role.findOne({ 
      where: { name: role || 'user' },
      transaction
    });
    
    if (!roleRecord) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Rol no válido' });
    }

    // Crear usuario (sin email/password)
    const user = await User.create({ 
      nombre: nombre || '',
      apellido: apellido || '',
      roleId: roleRecord.id,
      status: 'active'
    }, { transaction });

    // Crear credenciales
    await Credential.create({
      email,
      password,
      userId: user.id,
      isVerified: false
    }, { transaction });

    // Generar session_id único
    const sessionId = `session_${uuidv4().replace(/-/g, '')}`;
    
    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        role: roleRecord.name,
        roleId: user.roleId,
        sessionId: sessionId
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Guardar en Redis
    const redis = await connectRedis();
    
    const sessionData = {
      "session": {
        "token": token,
        "user": {
          "role": roleRecord.name,
          "email": email,
          "nombre": user.nombre,
          "apellido": user.apellido
        }
      }
    };

    await redis.set(sessionId, JSON.stringify(sessionData), { 
      EX: 3600
    });

    await redis.set(`user:${user.id}:session`, sessionId, { EX: 3600 });

    await transaction.commit();

    res.status(201).json({
      message: 'Usuario registrado y sesión iniciada',
      sessionId: sessionId,
      token: token,
      user: {
        id: user.id,
        email: email,
        role: roleRecord.name,
        nombre: user.nombre,
        apellido: user.apellido
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error en register:', error);
    
    let errorMessage = 'Error interno del servidor';
    if (error.name === 'SequelizeValidationError') {
      errorMessage = 'Error de validación: ' + error.errors.map(e => e.message).join(', ');
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errorMessage = 'El email ya existe';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message
    });
  }
};
// src/controllers/authController.js
exports.getAvailableRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      attributes: ['id', 'name', 'description'],
      order: [['name', 'ASC']]
    });
    
    res.json({ 
      roles: roles.map(role => ({
        name: role.name,
        description: role.description
      }))
    });
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

async function createTestUser() {
  try {
    const existing = await User.findOne({ where: { email: 'test@example.com' } });
    if (!existing) {
      await User.create({
        email: 'test@example.com',
        password: 'password123',  // Se hashea auto
        role: 'admin',
      });
      console.log('User de prueba creado');
    }
  } catch (error) {
    console.error('Error creando user test:', error);
  }
}

exports.createTestUser = createTestUser;