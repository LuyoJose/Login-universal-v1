// src/routes/auth.js (actualizado)
const express = require('express');
const { login, verifyToken, register } = require('../controllers/authController');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);  // Nueva
router.get('/verify', verifyToken);

// Ruta protegida por rol (usa middleware)
router.get('/admin-only', authMiddleware, (req, res) => {  // authMiddleware de antes
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  res.json({ message: 'Admin access OK', user: req.user });
});

module.exports = router;