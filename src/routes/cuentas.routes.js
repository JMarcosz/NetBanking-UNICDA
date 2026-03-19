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

// GET /api/cuentas/:numeroCuenta/transferencias - Historial de transferencias por cuenta
router.get('/:numeroCuenta/transferencias', authMiddleware, (req, res) => {
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

  // Verificar que la cuenta pertenece al usuario
  if (cuenta.titular.idCliente !== req.user.idCliente) {
    return res.status(403).json({
      codigo: 'ACCESO_DENEGADO',
      mensaje: 'La cuenta no pertenece al usuario autenticado',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const transferencias = readData('transferencias.json');
  let resultado = transferencias.filter(t =>
    t.cuentaOrigen === req.params.numeroCuenta || t.cuentaDestino === req.params.numeroCuenta
  );

  // Filtro por fechas
  if (req.query.fechaDesde) {
    const desde = new Date(req.query.fechaDesde);
    resultado = resultado.filter(t => new Date(t.fecha) >= desde);
  }
  if (req.query.fechaHasta) {
    const hasta = new Date(req.query.fechaHasta + 'T23:59:59Z');
    resultado = resultado.filter(t => new Date(t.fecha) <= hasta);
  }

  // Filtro por estado
  if (req.query.estado) {
    resultado = resultado.filter(t => t.estado === req.query.estado.toUpperCase());
  }

  // Filtro por tipo (LOCAL / INTERBANCARIA)
  if (req.query.tipo) {
    resultado = resultado.filter(t => (t.tipo || 'LOCAL') === req.query.tipo.toUpperCase());
  }

  // Ordenar por fecha descendente
  resultado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Paginación
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const tamanio = Math.min(100, Math.max(1, parseInt(req.query.tamanio) || 10));
  const totalRegistros = resultado.length;
  const totalPaginas = Math.ceil(totalRegistros / tamanio) || 1;
  const inicio = (pagina - 1) * tamanio;
  const paginado = resultado.slice(inicio, inicio + tamanio);

  // Mapear sin campos internos
  const data = paginado.map(({ idCliente, codigoAutorizacion, idBeneficiario, mensaje, ...rest }) => rest);

  res.json({
    numeroCuenta: req.params.numeroCuenta,
    data,
    paginacion: {
      pagina,
      tamanio,
      totalRegistros,
      totalPaginas
    }
  });
});

module.exports = router;
