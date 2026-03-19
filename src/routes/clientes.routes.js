const express = require('express');
const { readData } = require('../helpers/db');
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/clientes/me - Obtener perfil del usuario autenticado
router.get('/me', authMiddleware, requireRole('CLIENTE', 'ADMIN_BANCO', 'AUDITOR'), (req, res) => {
  const clientes = readData('clientes.json');
  const cliente = clientes.find(c => c.idCliente === req.user.idCliente);

  if (!cliente) {
    return res.status(404).json({
      codigo: 'CLIENTE_NO_ENCONTRADO',
      mensaje: 'No se encontró el perfil del cliente',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  res.json(cliente);
});

module.exports = router;
