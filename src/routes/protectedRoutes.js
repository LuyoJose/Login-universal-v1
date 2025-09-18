// src/routes/protectedRoutes.js
const express = require('express');
const { checkPermission } = require('../middleware/checkPermission');
const router = express.Router();

// Solo usuarios con permiso de lectura
router.get('/data', checkPermission('read'), (req, res) => {
  res.json({ message: 'Datos protegidos de lectura' });
});

// Agrega esta ruta


// Solo usuarios con permiso de escritura
router.post('/data', checkPermission('write'), (req, res) => {
  res.json({ message: 'Datos creados' });
});

// Solo usuarios con permiso de edición
router.put('/data/:id', checkPermission('edit'), (req, res) => {
  res.json({ message: 'Datos actualizados' });
});

// Solo usuarios con permiso de eliminación
router.delete('/data/:id', checkPermission('delete'), (req, res) => {
  res.json({ message: 'Datos eliminados' });
});

module.exports = router;