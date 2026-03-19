const express = require('express');
const { readData, writeData } = require('../helpers/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const LIMITE_DIARIO = 200000; // RD$200,000
const MONTO_SOSPECHOSO = 50000; // RD$50,000

/**
 * Genera un ID de transacción único
 */
function generarIdTransaccion() {
  const now = new Date();
  const fecha = now.toISOString().slice(0, 10).replace(/-/g, '');
  const transferencias = readData('transferencias.json');
  const count = transferencias.length + 1;
  return `TRX-${fecha}-${String(count).padStart(4, '0')}`;
}

/**
 * Genera un código de autorización
 */
function generarCodigoAutorizacion() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `AUT-${num}`;
}

// GET /api/transferencias - Historial de transferencias paginado
router.get('/', authMiddleware, (req, res) => {
  const transferencias = readData('transferencias.json');
  let resultado = transferencias.filter(t => t.idCliente === req.user.idCliente);

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

  // Ordenar por fecha descendente
  resultado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Paginación
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const tamanio = Math.min(100, Math.max(1, parseInt(req.query.tamanio) || 10));
  const totalRegistros = resultado.length;
  const totalPaginas = Math.ceil(totalRegistros / tamanio) || 1;
  const inicio = (pagina - 1) * tamanio;
  const paginado = resultado.slice(inicio, inicio + tamanio);

  // Mapear a la respuesta (sin campos internos)
  const data = paginado.map(({ idCliente, codigoAutorizacion, idBeneficiario, mensaje, ...rest }) => rest);

  res.json({
    data,
    paginacion: {
      pagina,
      tamanio,
      totalRegistros,
      totalPaginas
    }
  });
});

// POST /api/transferencias - Crear transferencia
router.post('/', authMiddleware, (req, res) => {
  const { cuentaOrigen, cuentaDestino, monto, moneda, concepto, idBeneficiario } = req.body;

  // Validaciones básicas
  const errores = {};
  if (!cuentaOrigen) errores.cuentaOrigen = ['La cuenta origen es requerida'];
  else if (cuentaOrigen.length < 10 || cuentaOrigen.length > 25)
    errores.cuentaOrigen = ['La longitud debe estar entre 10 y 25 caracteres'];
  
  if (!cuentaDestino) errores.cuentaDestino = ['La cuenta destino es requerida'];
  else if (cuentaDestino.length < 10 || cuentaDestino.length > 25)
    errores.cuentaDestino = ['La longitud debe estar entre 10 y 25 caracteres'];
  
  if (!monto || monto <= 0) errores.monto = ['El monto debe ser mayor que 0'];
  if (!moneda) errores.moneda = ['La moneda es requerida'];
  else if (!['DOP', 'USD', 'EUR'].includes(moneda.toUpperCase()))
    errores.moneda = ['La moneda debe ser DOP, USD o EUR'];
  
  if (!concepto) errores.concepto = ['El concepto es requerido'];
  else if (concepto.length > 140)
    errores.concepto = ['El concepto no puede exceder 140 caracteres'];

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'Solicitud inválida o error de validación',
      detalles: errores,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar cuentas
  const cuentas = readData('cuentas.json');
  const ctaOrigen = cuentas.find(c => c.numeroCuenta === cuentaOrigen);
  const ctaDestino = cuentas.find(c => c.numeroCuenta === cuentaDestino);

  if (!ctaOrigen || !ctaDestino) {
    return res.status(404).json({
      codigo: 'CUENTA_NO_ENCONTRADA',
      mensaje: 'La cuenta origen o destino no existe',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar que la cuenta origen pertenece al usuario
  if (ctaOrigen.titular.idCliente !== req.user.idCliente) {
    return res.status(403).json({
      codigo: 'ACCESO_DENEGADO',
      mensaje: 'La cuenta origen no pertenece al usuario autenticado',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar cuentas activas
  if (ctaOrigen.estado !== 'ACTIVA' || ctaDestino.estado !== 'ACTIVA') {
    return res.status(403).json({
      codigo: 'CUENTA_INACTIVA',
      mensaje: 'La cuenta origen o destino está inactiva',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar saldo suficiente
  if (ctaOrigen.saldoDisponible < monto) {
    return res.status(403).json({
      codigo: 'SALDO_INSUFICIENTE',
      mensaje: 'La cuenta no tiene saldo suficiente para realizar la operación',
      detalles: {
        saldoDisponible: ctaOrigen.saldoDisponible,
        montoSolicitado: monto,
        montoFaltante: monto - ctaOrigen.saldoDisponible
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar límite diario (solo para DOP)
  if (moneda.toUpperCase() === 'DOP') {
    const transferencias = readData('transferencias.json');
    const hoy = new Date().toISOString().slice(0, 10);
    const montoAcumulado = transferencias
      .filter(t => 
        t.idCliente === req.user.idCliente && 
        t.moneda === 'DOP' &&
        t.estado !== 'RECHAZADA' &&
        t.fecha.slice(0, 10) === hoy
      )
      .reduce((sum, t) => sum + t.monto, 0);

    if (montoAcumulado + monto > LIMITE_DIARIO) {
      return res.status(403).json({
        codigo: 'LIMITE_DIARIO_EXCEDIDO',
        mensaje: `Se ha excedido el límite diario de RD$${LIMITE_DIARIO.toLocaleString()} para transferencias`,
        detalles: {
          limiteDiario: LIMITE_DIARIO,
          montoAcumulado,
          montoSolicitado: monto
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId
      });
    }
  }

  // Detectar operación sospechosa
  let estado = 'COMPLETADA';
  let mensaje = 'Transferencia procesada correctamente';

  if (monto >= MONTO_SOSPECHOSO) {
    estado = 'EN_REVISION';
    mensaje = 'La transferencia ha sido marcada para revisión por sospecha';
  }

  // Si es sospechosa, retornar 422
  if (estado === 'EN_REVISION') {
    // Aun así registrarla
    const transferencias = readData('transferencias.json');
    const nuevaTransferencia = {
      idTransaccion: generarIdTransaccion(),
      idCliente: req.user.idCliente,
      estado,
      fecha: new Date().toISOString(),
      monto,
      moneda: moneda.toUpperCase(),
      concepto,
      cuentaOrigen,
      cuentaDestino,
      idBeneficiario: idBeneficiario || null,
      codigoAutorizacion: generarCodigoAutorizacion(),
      mensaje
    };
    transferencias.push(nuevaTransferencia);
    writeData('transferencias.json', transferencias);

    // Registrar auditoría
    registrarAuditoria(req.user.username, 'TRANSFERENCIA', 
      `Transferencia marcada como sospechosa por RD$${monto.toLocaleString()}`);

    return res.status(422).json({
      codigo: 'OPERACION_SOSPECHOSA',
      mensaje,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Crear transferencia
  const transferencias = readData('transferencias.json');
  const nuevaTransferencia = {
    idTransaccion: generarIdTransaccion(),
    idCliente: req.user.idCliente,
    estado,
    fecha: new Date().toISOString(),
    monto,
    moneda: moneda.toUpperCase(),
    concepto,
    cuentaOrigen,
    cuentaDestino,
    idBeneficiario: idBeneficiario || null,
    codigoAutorizacion: generarCodigoAutorizacion(),
    mensaje
  };

  transferencias.push(nuevaTransferencia);
  writeData('transferencias.json', transferencias);

  // Actualizar saldos
  const indexOrigen = cuentas.findIndex(c => c.numeroCuenta === cuentaOrigen);
  const indexDestino = cuentas.findIndex(c => c.numeroCuenta === cuentaDestino);
  cuentas[indexOrigen].saldoDisponible -= monto;
  cuentas[indexOrigen].saldoContable -= monto;
  cuentas[indexDestino].saldoDisponible += monto;
  cuentas[indexDestino].saldoContable += monto;
  writeData('cuentas.json', cuentas);

  // Registrar auditoría
  registrarAuditoria(req.user.username, 'TRANSFERENCIA', 
    `Transferencia realizada por RD$${monto.toLocaleString()}`);

  res.status(201).json({
    idTransaccion: nuevaTransferencia.idTransaccion,
    estado: nuevaTransferencia.estado,
    fecha: nuevaTransferencia.fecha,
    monto: nuevaTransferencia.monto,
    moneda: nuevaTransferencia.moneda,
    concepto: nuevaTransferencia.concepto,
    cuentaOrigen: nuevaTransferencia.cuentaOrigen,
    cuentaDestino: nuevaTransferencia.cuentaDestino
  });
});

// Lista de bancos simulados para transferencias interbancarias
const BANCOS_DISPONIBLES = [
  { codigo: 'BHD', nombre: 'Banco BHD León' },
  { codigo: 'POPULAR', nombre: 'Banco Popular Dominicano' },
  { codigo: 'RESERVAS', nombre: 'Banco de Reservas' },
  { codigo: 'SCOTIABANK', nombre: 'Scotiabank' },
  { codigo: 'BANRESERVAS', nombre: 'Banreservas' },
  { codigo: 'DEMO', nombre: 'Banco Demo' }
];
const COMISION_INTERBANCARIA = 75; // RD$75 por transferencia interbancaria

// POST /api/transferencias/interbancaria - Crear transferencia interbancaria
router.post('/interbancaria', authMiddleware, (req, res) => {
  const { cuentaOrigen, cuentaDestino, monto, moneda, concepto, bancoDestino, nombreDestinatario } = req.body;

  // Validaciones básicas
  const errores = {};
  if (!cuentaOrigen) errores.cuentaOrigen = ['La cuenta origen es requerida'];
  else if (cuentaOrigen.length < 10 || cuentaOrigen.length > 25)
    errores.cuentaOrigen = ['La longitud debe estar entre 10 y 25 caracteres'];
  
  if (!cuentaDestino) errores.cuentaDestino = ['La cuenta destino es requerida'];
  
  if (!monto || monto <= 0) errores.monto = ['El monto debe ser mayor que 0'];
  if (!moneda) errores.moneda = ['La moneda es requerida'];
  else if (!['DOP', 'USD', 'EUR'].includes(moneda.toUpperCase()))
    errores.moneda = ['La moneda debe ser DOP, USD o EUR'];
  
  if (!concepto) errores.concepto = ['El concepto es requerido'];
  else if (concepto.length > 140)
    errores.concepto = ['El concepto no puede exceder 140 caracteres'];

  if (!bancoDestino) errores.bancoDestino = ['El banco destino es requerido'];
  if (!nombreDestinatario) errores.nombreDestinatario = ['El nombre del destinatario es requerido'];

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'Solicitud inválida o error de validación',
      detalles: errores,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar banco destino disponible
  const banco = BANCOS_DISPONIBLES.find(b => 
    b.codigo === bancoDestino.toUpperCase() || 
    b.nombre.toLowerCase() === bancoDestino.toLowerCase()
  );

  if (!banco) {
    return res.status(502).json({
      codigo: 'BANCO_NO_DISPONIBLE',
      mensaje: `El banco destino '${bancoDestino}' no está disponible o no es válido`,
      detalles: {
        bancosDisponibles: BANCOS_DISPONIBLES.map(b => ({ codigo: b.codigo, nombre: b.nombre }))
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar cuenta origen
  const cuentas = readData('cuentas.json');
  const ctaOrigen = cuentas.find(c => c.numeroCuenta === cuentaOrigen);

  if (!ctaOrigen) {
    return res.status(404).json({
      codigo: 'CUENTA_NO_ENCONTRADA',
      mensaje: 'La cuenta origen no existe',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar que pertenece al usuario
  if (ctaOrigen.titular.idCliente !== req.user.idCliente) {
    return res.status(403).json({
      codigo: 'ACCESO_DENEGADO',
      mensaje: 'La cuenta origen no pertenece al usuario autenticado',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar cuenta activa
  if (ctaOrigen.estado !== 'ACTIVA') {
    return res.status(403).json({
      codigo: 'CUENTA_INACTIVA',
      mensaje: 'La cuenta origen está inactiva',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Calcular monto total (monto + comisión)
  const montoTotal = monto + COMISION_INTERBANCARIA;

  // Verificar saldo suficiente (monto + comisión)
  if (ctaOrigen.saldoDisponible < montoTotal) {
    return res.status(403).json({
      codigo: 'SALDO_INSUFICIENTE',
      mensaje: 'La cuenta no tiene saldo suficiente (se incluye comisión interbancaria)',
      detalles: {
        saldoDisponible: ctaOrigen.saldoDisponible,
        montoTransferencia: monto,
        comisionInterbancaria: COMISION_INTERBANCARIA,
        montoTotal,
        montoFaltante: montoTotal - ctaOrigen.saldoDisponible
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Verificar límite diario (solo para DOP)
  if (moneda.toUpperCase() === 'DOP') {
    const transferencias = readData('transferencias.json');
    const hoy = new Date().toISOString().slice(0, 10);
    const montoAcumulado = transferencias
      .filter(t => 
        t.idCliente === req.user.idCliente && 
        t.moneda === 'DOP' &&
        t.estado !== 'RECHAZADA' &&
        t.fecha.slice(0, 10) === hoy
      )
      .reduce((sum, t) => sum + t.monto, 0);

    if (montoAcumulado + monto > LIMITE_DIARIO) {
      return res.status(403).json({
        codigo: 'LIMITE_DIARIO_EXCEDIDO',
        mensaje: `Se ha excedido el límite diario de RD$${LIMITE_DIARIO.toLocaleString()} para transferencias`,
        detalles: {
          limiteDiario: LIMITE_DIARIO,
          montoAcumulado,
          montoSolicitado: monto
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId
      });
    }
  }

  // Detectar operación sospechosa
  let estado = 'COMPLETADA';
  let mensaje = 'Transferencia interbancaria procesada correctamente';

  if (monto >= MONTO_SOSPECHOSO) {
    estado = 'EN_REVISION';
    mensaje = 'La transferencia interbancaria ha sido marcada para revisión por sospecha';

    const transferencias = readData('transferencias.json');
    const nuevaTransferencia = {
      idTransaccion: generarIdTransaccion(),
      idCliente: req.user.idCliente,
      tipo: 'INTERBANCARIA',
      estado,
      fecha: new Date().toISOString(),
      monto,
      comision: COMISION_INTERBANCARIA,
      montoTotal,
      moneda: moneda.toUpperCase(),
      concepto,
      cuentaOrigen,
      cuentaDestino,
      bancoDestino: banco.nombre,
      codigoBanco: banco.codigo,
      nombreDestinatario,
      codigoAutorizacion: generarCodigoAutorizacion(),
      referenciaExterna: `REF-${banco.codigo}-${Date.now()}`,
      mensaje
    };
    transferencias.push(nuevaTransferencia);
    writeData('transferencias.json', transferencias);

    registrarAuditoria(req.user.username, 'TRANSFERENCIA',
      `Transferencia interbancaria sospechosa a ${banco.nombre} por RD$${monto.toLocaleString()}`);

    return res.status(422).json({
      codigo: 'OPERACION_SOSPECHOSA',
      mensaje,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Crear transferencia interbancaria
  const transferencias = readData('transferencias.json');
  const nuevaTransferencia = {
    idTransaccion: generarIdTransaccion(),
    idCliente: req.user.idCliente,
    tipo: 'INTERBANCARIA',
    estado,
    fecha: new Date().toISOString(),
    monto,
    comision: COMISION_INTERBANCARIA,
    montoTotal,
    moneda: moneda.toUpperCase(),
    concepto,
    cuentaOrigen,
    cuentaDestino,
    bancoDestino: banco.nombre,
    codigoBanco: banco.codigo,
    nombreDestinatario,
    codigoAutorizacion: generarCodigoAutorizacion(),
    referenciaExterna: `REF-${banco.codigo}-${Date.now()}`,
    mensaje
  };

  transferencias.push(nuevaTransferencia);
  writeData('transferencias.json', transferencias);

  // Debitar monto + comisión de la cuenta origen
  const indexOrigen = cuentas.findIndex(c => c.numeroCuenta === cuentaOrigen);
  cuentas[indexOrigen].saldoDisponible -= montoTotal;
  cuentas[indexOrigen].saldoContable -= montoTotal;
  writeData('cuentas.json', cuentas);

  // Registrar auditoría
  registrarAuditoria(req.user.username, 'TRANSFERENCIA',
    `Transferencia interbancaria a ${banco.nombre} por RD$${monto.toLocaleString()} + comisión RD$${COMISION_INTERBANCARIA}`);

  res.status(201).json({
    idTransaccion: nuevaTransferencia.idTransaccion,
    tipo: 'INTERBANCARIA',
    estado: nuevaTransferencia.estado,
    fecha: nuevaTransferencia.fecha,
    monto: nuevaTransferencia.monto,
    comision: nuevaTransferencia.comision,
    montoTotal: nuevaTransferencia.montoTotal,
    moneda: nuevaTransferencia.moneda,
    concepto: nuevaTransferencia.concepto,
    cuentaOrigen: nuevaTransferencia.cuentaOrigen,
    cuentaDestino: nuevaTransferencia.cuentaDestino,
    bancoDestino: nuevaTransferencia.bancoDestino,
    nombreDestinatario: nuevaTransferencia.nombreDestinatario,
    referenciaExterna: nuevaTransferencia.referenciaExterna
  });
});

// GET /api/transferencias/:idTransaccion - Detalle de transferencia
router.get('/:idTransaccion', authMiddleware, (req, res) => {
  const transferencias = readData('transferencias.json');
  const transferencia = transferencias.find(t => t.idTransaccion === req.params.idTransaccion);

  if (!transferencia) {
    return res.status(404).json({
      codigo: 'TRANSFERENCIA_NO_ENCONTRADA',
      mensaje: 'No se encontró la transferencia especificada',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Retornar detalle completo (sin campos internos)
  const { idCliente, codigoAutorizacion, ...detalle } = transferencia;
  res.json(detalle);
});

// GET /api/transferencias/:idTransaccion/comprobante - Comprobante de transferencia
router.get('/:idTransaccion/comprobante', authMiddleware, (req, res) => {
  const transferencias = readData('transferencias.json');
  const transferencia = transferencias.find(t => t.idTransaccion === req.params.idTransaccion);

  if (!transferencia) {
    return res.status(404).json({
      codigo: 'TRANSFERENCIA_NO_ENCONTRADA',
      mensaje: 'No se encontró la transferencia especificada',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  res.json({
    idTransaccion: transferencia.idTransaccion,
    codigoAutorizacion: transferencia.codigoAutorizacion,
    fecha: transferencia.fecha,
    estado: transferencia.estado,
    mensaje: transferencia.mensaje
  });
});

/**
 * Registra un evento de auditoría
 */
function registrarAuditoria(usuario, tipoEvento, descripcion) {
  try {
    const auditoria = readData('auditoria.json');
    auditoria.push({
      idEvento: `EVT-${String(auditoria.length + 1).padStart(4, '0')}`,
      usuario,
      tipoEvento,
      descripcion,
      fecha: new Date().toISOString()
    });
    writeData('auditoria.json', auditoria);
  } catch (e) { /* silently continue */ }
}

module.exports = router;
