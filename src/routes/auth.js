// src/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { checkPermission } = require('../middleware/checkPermission');

// ---------------------------------------------------
// LOGIN
router.post('/login', authController.login);

// REGISTER (solo superadmin)
router.post(
    '/register',
    authController.isSuperAdmin, // middleware que valida superadmin
    authController.register
);

// ---------------------------------------------------
// RUTAS PROTEGIDAS POR PERMISOS

// Obtener todos los usuarios con sus roles
router.get(
    '/users',
    checkPermission('read'), // verifica permiso 'read'
    authController.getUsersWithRoles
);

// Obtener todos los roles disponibles
router.get(
    '/roles',
    checkPermission('read'), // verifica permiso 'read'
    authController.getAvailableRoles
);

// ---------------------------------------------------
// GESTIÓN DE ROLES (solo superadmin)
router.post(
    '/assign-role',
    authController.isSuperAdmin,
    authController.assignRoleToUser
);

router.post(
    '/remove-role',
    authController.isSuperAdmin,
    authController.removeRoleFromUser
);

// ---------------------------------------------------
// RUTA DE PRUEBA: crear usuario de test
router.post('/create-test-user', authController.createTestUser);

module.exports = router;
