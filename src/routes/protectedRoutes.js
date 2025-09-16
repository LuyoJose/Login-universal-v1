const express = require('express');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

const router = express.Router();

// Ruta accesible solo si estás logueado
router.get('/profile', auth, checkPermission('read:profile'), (req, res) => {
  res.json({ message: 'Tu perfil', user: req.user });
});

// Ruta que solo admin o manager pueden usar
router.post('/orders', auth, checkPermission('create:order'), (req, res) => {
  res.json({ message: 'Orden creada' });
});

// Ruta solo admin (porque en roles.js le dimos "*")
router.delete('/admin/delete-user', auth, checkPermission('delete:user'), (req, res) => {
  res.json({ message: 'Usuario eliminado (solo admin)' });
});

module.exports = router;
