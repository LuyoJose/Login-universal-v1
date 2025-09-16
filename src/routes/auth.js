// src/routes/auth.js (actualizado)
const express = require('express');
const { login, verifyToken, register } = require('../controllers/authController');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);  // Nueva
router.get('/verify', verifyToken);

module.exports = router;