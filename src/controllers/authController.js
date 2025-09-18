// src/controllers/authController.js (actualizado)
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../utils/redis');
const config = require('../config');
const { User, Role } = require('../models');
const { v4: uuidv4 } = require('uuid');

// Función helper para crear user de prueba (solo dev)
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

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y password requeridos' });

    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const sessionId = `session_${uuidv4().replace(/-/g, '')}`;
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        roleId: user.roleId,
        sessionId: sessionId
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const redis = await connectRedis();
    
    // MODIFICA ESTO según los campos que tengas en User:
    const sessionData = {
      "session": {
        "token": token,
        "user": {
          "role": user.role,
          "email": user.email || "",
          "nombre": user.nombre || "",
          "apellido": user.apellido || ""
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
      token: token
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
exports.register = async (req, res) => {
  // Agrega esta línea al inicio de la función
  let roleRecord; // ← DECLARA la variable aquí

  try {
    console.log('Datos recibidos en register:', req.body);
    
    const { email, password, role, nombre, apellido } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }

    console.log('Buscando role:', role || 'user');
    
    // Buscar el role por nombre para obtener su ID
    roleRecord = await Role.findOne({  // ← Ahora roleRecord está definida
      where: { name: role || 'user' }
    });
    
    console.log('Role encontrado:', roleRecord ? roleRecord.name : 'null');
    
    if (!roleRecord) {
      return res.status(400).json({ 
        error: 'Rol no válido', 
        availableRoles: ['admin', 'manager', 'user'] 
      });
    }

    // Verificar si el usuario ya existe
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Crear nuevo usuario con el roleId correcto
    const user = await User.create({ 
      email, 
      password, 
      roleId: roleRecord.id,
      nombre: nombre || '',
      apellido: apellido || ''
    });

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
          "email": user.email,
          "nombre": user.nombre,
          "apellido": user.apellido
        }
      }
    };

    await redis.set(sessionId, JSON.stringify(sessionData), { 
      EX: 3600
    });

    await redis.set(`user:${user.id}:session`, sessionId, { EX: 3600 });

    res.status(201).json({
      message: 'Usuario registrado y sesión iniciada',
      sessionId: sessionId,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        role: roleRecord.name,
        nombre: user.nombre,
        apellido: user.apellido
      }
    });

  } catch (error) {
    console.error('Error DETAILED en register:', error);
    console.error('Stack trace:', error.stack);
    
    // Mensaje de error más informativo
    let errorMessage = 'Error interno del servidor';
    if (error.name === 'SequelizeValidationError') {
      errorMessage = 'Error de validación: ' + error.errors.map(e => e.message).join(', ');
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errorMessage = 'El email ya existe';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      roleSearched: role || 'user',
      roleFound: !!roleRecord
    });
  }
};
// En authController.js
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