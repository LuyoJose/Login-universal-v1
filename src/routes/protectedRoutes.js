// src/routes/protectedRoutes.js
const express = require('express');
const router = express.Router();

const { checkPermission } = require('../middleware/checkPermission');
const authController = require('../controllers/authController');

// ---------------------------------------------------
// Rutas de prueba (protegidas por permisos)
router.get(
  '/users',
  checkPermission('read'),
  authController.getUsersWithRoles
);

router.get(
  '/roles',
  checkPermission('read'),
  authController.getAvailableRoles
);

// ---------------------------------------------------
// Gestión de roles (solo superadmin)
router.post(
  '/assign-role',
  authController.isSuperAdmin,       // Solo superadmin
  authController.assignRoleToUser
);

router.post(
  '/remove-role',
  authController.isSuperAdmin,       // Solo superadmin
  authController.removeRoleFromUser
);

// ---------------------------------------------------
// Ruta para crear usuario de prueba (no protegida)
router.post('/create-test-user', authController.createTestUser);

module.exports = router;
