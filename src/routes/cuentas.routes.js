const express = require('express');
const { readData } = require('../helpers/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/cuentas - Listar cuentas del cliente autenticado
router.get('/', authMiddleware, (req, res) => {
  const cuentas = readData('cuentas.json');
  let resultado = cuentas.filter(c => c.titular.idCliente === req.user.idCliente);

  // Filtro por estado
  if (req.query.estado) {
    resultado = resultado.filter(c => c.estado === req.query.estado.toUpperCase());
  }

  // Filtro por moneda
  if (req.query.moneda) {
    resultado = resultado.filter(c => c.moneda === req.query.moneda.toUpperCase());
  }

  res.json(resultado);
});

// GET /api/cuentas/:numeroCuenta - Detalle de una cuenta
router.get('/:numeroCuenta', authMiddleware, (req, res) => {
  const cuentas = readData('cuentas.json');
  const cuenta = cuentas.find(c => c.numeroCuenta === req.params.numeroCuenta);

  if (!cuenta) {
    return res.status(404).json({
      codigo: 'CUENTA_NO_ENCONTRADA',
      mensaje: 'La cuenta solicitada no existe',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  res.json(cuenta);
});

module.exports = router;
