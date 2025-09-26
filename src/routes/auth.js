// src/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth'); // ✅ valida el JWT y setea req.user
const { checkPermission } = require('../middleware/checkPermission');

// ---------------------------------------------------
// LOGIN (público)
router.post('/login', authController.login);
// LOGOUT (público)
router.post('/logout', authController.logout);
// ---------------------------------------------------
// REGISTER (solo superadmin)
router.post(
    '/register',
    auth,          
    checkPermission('create_user'),        // 🔑 primero valida token y setea req.user, 
    authController.register
);

// Eliminar usuario
router.delete(
    '/users/:userId', 
    auth,
    checkPermission('delete_user'), 
    authController.deleteUser
);

// ---------------------------------------------------
// RUTAS PROTEGIDAS POR PERMISOS

// Obtener todos los usuarios con sus roles
router.get(
    '/users',
    auth,                  // ✅ siempre valida token
    checkPermission('read'),
    authController.getUsersWithRoles
);

// Obtener todos los roles disponibles
router.get(
    '/roles',
    auth, 
    checkPermission('read'),
    authController.getAvailableRoles
);

// ---------------------------------------------------
// GESTIÓN DE ROLES (solo superadmin)
router.post(
    '/assign-role',
    auth, 
    authController.isSuperAdmin,
    authController.assignRoleToUser
);

router.post(
    '/remove-role',
    auth, 
    authController.isSuperAdmin,
    authController.removeRoleFromUser
);

// ---------------------------------------------------
// RUTA DE PRUEBA: crear usuario de test
router.post(
    '/create-test-user',
    auth,   // 🔒 también conviene protegerla
    authController.createTestUser
);

// Recuperar contraseña (envía email)
// Enviar OTP
router.post('/forgot-password-otp', authController.sendOtp);

// Resetear contraseña con OTP
router.post('/reset-password-otp', authController.resetPasswordWithOtp);



module.exports = router;
