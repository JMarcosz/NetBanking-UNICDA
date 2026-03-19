const express = require('express');
const { readData, writeData } = require('../helpers/db');
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/admin/transferencias/sospechosas - Listar transferencias sospechosas
router.get('/transferencias/sospechosas', authMiddleware, requireRole('ADMIN_BANCO', 'AUDITOR'), (req, res) => {
  const transferencias = readData('transferencias.json');
  
  // Filtrar solo EN_REVISION por defecto, o por estadoRevision proporcionado
  let resultado = transferencias.filter(t => {
    if (req.query.estadoRevision) {
      return t.estado === req.query.estadoRevision.toUpperCase();
    }
    return t.estado === 'EN_REVISION';
  });

  // Filtro por fechas
  if (req.query.fechaDesde) {
    const desde = new Date(req.query.fechaDesde);
    resultado = resultado.filter(t => new Date(t.fecha) >= desde);
  }
  if (req.query.fechaHasta) {
    const hasta = new Date(req.query.fechaHasta + 'T23:59:59Z');
    resultado = resultado.filter(t => new Date(t.fecha) <= hasta);
  }

  // Mapear a detalle completo
  const data = resultado.map(({ idCliente, codigoAutorizacion, ...rest }) => rest);
  res.json(data);
});

// PATCH /api/admin/transferencias/:idTransaccion/revision - Aprobar o rechazar transferencia
router.patch('/transferencias/:idTransaccion/revision', authMiddleware, requireRole('ADMIN_BANCO'), (req, res) => {
  const { accion, comentario } = req.body;

  if (!accion || !['APROBAR', 'RECHAZAR'].includes(accion.toUpperCase())) {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'La acción debe ser APROBAR o RECHAZAR',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const transferencias = readData('transferencias.json');
  const index = transferencias.findIndex(t => t.idTransaccion === req.params.idTransaccion);

  if (index === -1) {
    return res.status(404).json({
      codigo: 'TRANSFERENCIA_NO_ENCONTRADA',
      mensaje: 'No se encontró la transferencia especificada',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  if (transferencias[index].estado !== 'EN_REVISION') {
    return res.status(400).json({
      codigo: 'ESTADO_INVALIDO',
      mensaje: 'Solo se pueden revisar transferencias en estado EN_REVISION',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const nuevoEstado = accion.toUpperCase() === 'APROBAR' ? 'APROBADA' : 'RECHAZADA';
  transferencias[index].estado = nuevoEstado;
  transferencias[index].mensaje = accion.toUpperCase() === 'APROBAR' 
    ? 'Transferencia aprobada tras revisión manual' 
    : 'Transferencia rechazada tras revisión manual';

  writeData('transferencias.json', transferencias);

  // Si se aprobó, actualizar saldos
  if (nuevoEstado === 'APROBADA') {
    const cuentas = readData('cuentas.json');
    const indexOrigen = cuentas.findIndex(c => c.numeroCuenta === transferencias[index].cuentaOrigen);
    const indexDestino = cuentas.findIndex(c => c.numeroCuenta === transferencias[index].cuentaDestino);
    
    if (indexOrigen !== -1 && indexDestino !== -1) {
      cuentas[indexOrigen].saldoDisponible -= transferencias[index].monto;
      cuentas[indexOrigen].saldoContable -= transferencias[index].monto;
      cuentas[indexDestino].saldoDisponible += transferencias[index].monto;
      cuentas[indexDestino].saldoContable += transferencias[index].monto;
      writeData('cuentas.json', cuentas);
    }
  }

  // Registrar auditoría
  try {
    const auditoria = readData('auditoria.json');
    auditoria.push({
      idEvento: `EVT-${String(auditoria.length + 1).padStart(4, '0')}`,
      usuario: req.user.username,
      tipoEvento: 'REVISION',
      descripcion: `Transferencia ${transferencias[index].idTransaccion} ${nuevoEstado.toLowerCase()}. ${comentario || ''}`.trim(),
      fecha: new Date().toISOString()
    });
    writeData('auditoria.json', auditoria);
  } catch (e) { /* silently continue */ }

  const { idCliente, codigoAutorizacion, ...detalle } = transferencias[index];
  res.json(detalle);
});

module.exports = router;
