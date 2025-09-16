// src/controllers/authController.js (actualizado)
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../utils/redis');
const config = require('../config');
const User = require('../models/User');  // Importa modelo

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

    // Busca en DB
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Genera JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Guarda en Redis
    const redis = await connectRedis();
    await redis.set(`token:${user.id}`, token, { EX: 3600 });
    await redis.set(
      `session:${user.id}`,
      JSON.stringify({ role: user.role, lastActive: Date.now() }),
      { EX: 3600 }
    );

    // 🔥 Solo devuelve el token
    res.json({ token });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno' });
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
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }

    // Verificar si ya existe
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Crear nuevo usuario (UUID automático por el modelo)
    const user = await User.create({ email, password, role });

    // (Opcional) guardar datos de sesión en Redis
    const redis = await connectRedis();
    await redis.set(
      `session:${user.id}`,
      JSON.stringify({ role: user.role, lastActive: Date.now() }),
      { EX: 3600 }
    );

    res.status(201).json({
      message: 'Usuario registrado',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error interno', details: error.message });
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