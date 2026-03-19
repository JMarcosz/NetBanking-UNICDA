const express = require('express');
const { readData, writeData } = require('../helpers/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/beneficiarios - Listar beneficiarios del cliente
router.get('/', authMiddleware, (req, res) => {
  const beneficiarios = readData('beneficiarios.json');
  const resultado = beneficiarios.filter(b => b.idCliente === req.user.idCliente);

  // Devolver sin el campo idCliente (no es parte del schema público)
  const respuesta = resultado.map(({ idCliente, ...rest }) => rest);
  res.json(respuesta);
});

// POST /api/beneficiarios - Registrar nuevo beneficiario
router.post('/', authMiddleware, (req, res) => {
  const { alias, nombreBeneficiario, numeroCuenta, banco, documentoIdentidad } = req.body;

  // Validaciones
  const errores = {};
  if (!alias) errores.alias = ['El alias es requerido'];
  if (!nombreBeneficiario) errores.nombreBeneficiario = ['El nombre del beneficiario es requerido'];
  if (!numeroCuenta) errores.numeroCuenta = ['El número de cuenta es requerido'];
  else if (numeroCuenta.length < 10 || numeroCuenta.length > 25) 
    errores.numeroCuenta = ['La longitud debe estar entre 10 y 25 caracteres'];
  if (!banco) errores.banco = ['El banco es requerido'];
  if (!documentoIdentidad) errores.documentoIdentidad = ['El documento de identidad es requerido'];

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'Error de validación en datos de entrada',
      detalles: errores,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const beneficiarios = readData('beneficiarios.json');

  // Verificar duplicado
  const existente = beneficiarios.find(
    b => b.idCliente === req.user.idCliente && b.numeroCuenta === numeroCuenta
  );

  if (existente) {
    return res.status(409).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'El beneficiario ya está registrado',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Generar ID
  const maxId = beneficiarios.reduce((max, b) => {
    const num = parseInt(b.idBeneficiario.split('-')[1]);
    return num > max ? num : max;
  }, 0);

  const nuevoBeneficiario = {
    idBeneficiario: `BEN-${String(maxId + 1).padStart(3, '0')}`,
    idCliente: req.user.idCliente,
    alias,
    nombreBeneficiario,
    numeroCuenta,
    banco,
    documentoIdentidad
  };

  beneficiarios.push(nuevoBeneficiario);
  writeData('beneficiarios.json', beneficiarios);

  // Respuesta sin idCliente
  const { idCliente, ...respuesta } = nuevoBeneficiario;
  res.status(201).json(respuesta);
});

// PUT /api/beneficiarios/:idBeneficiario - Actualizar beneficiario
router.put('/:idBeneficiario', authMiddleware, (req, res) => {
  const beneficiarios = readData('beneficiarios.json');
  const index = beneficiarios.findIndex(
    b => b.idBeneficiario === req.params.idBeneficiario && b.idCliente === req.user.idCliente
  );

  if (index === -1) {
    return res.status(404).json({
      codigo: 'BENEFICIARIO_NO_ENCONTRADO',
      mensaje: 'No se encontró el beneficiario especificado',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const { alias, nombreBeneficiario, numeroCuenta, banco, documentoIdentidad } = req.body;

  // Validación de numeroCuenta si se proporciona
  if (numeroCuenta && (numeroCuenta.length < 10 || numeroCuenta.length > 25)) {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'Error de validación en datos de entrada',
      detalles: { numeroCuenta: ['La longitud debe estar entre 10 y 25 caracteres'] },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Actualizar campos proporcionados
  if (alias !== undefined) beneficiarios[index].alias = alias;
  if (nombreBeneficiario !== undefined) beneficiarios[index].nombreBeneficiario = nombreBeneficiario;
  if (numeroCuenta !== undefined) beneficiarios[index].numeroCuenta = numeroCuenta;
  if (banco !== undefined) beneficiarios[index].banco = banco;
  if (documentoIdentidad !== undefined) beneficiarios[index].documentoIdentidad = documentoIdentidad;

  writeData('beneficiarios.json', beneficiarios);

  const { idCliente, ...respuesta } = beneficiarios[index];
  res.json(respuesta);
});

// DELETE /api/beneficiarios/:idBeneficiario - Eliminar beneficiario
router.delete('/:idBeneficiario', authMiddleware, (req, res) => {
  const beneficiarios = readData('beneficiarios.json');
  const index = beneficiarios.findIndex(
    b => b.idBeneficiario === req.params.idBeneficiario && b.idCliente === req.user.idCliente
  );

  if (index === -1) {
    return res.status(404).json({
      codigo: 'BENEFICIARIO_NO_ENCONTRADO',
      mensaje: 'No se encontró el beneficiario especificado',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  beneficiarios.splice(index, 1);
  writeData('beneficiarios.json', beneficiarios);

  res.status(204).send();
});

module.exports = router;
