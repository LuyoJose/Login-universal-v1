// src/routes/auth.js
const express = require('express');
const authController = require('../controllers/authController'); // ← Esta línea debe estar

const router = express.Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/verify', authController.verifyToken);
router.get('/available-roles', authController.getAvailableRoles);

module.exports = router;