const { readData, writeData } = require('../helpers/db');

// Almacén en memoria de tokens activos (simula una tabla de sesiones)
const activeSessions = new Map();

// Contador para generar tokens simples
let tokenCounter = 1000;

/**
 * Genera un token simulado (no JWT real, pero funcional para pruebas)
 */
function generateToken(prefix) {
  tokenCounter++;
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${tokenCounter}`;
}

/**
 * Autentica al usuario y genera tokens
 */
function login(req, res) {
  const { username, password, grantType } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'Username y password son requeridos',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  if (grantType && grantType !== 'password') {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'grantType debe ser "password"',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const usuarios = readData('usuarios.json');
  const usuario = usuarios.find(u => u.username === username && u.password === password);

  if (!usuario) {
    return res.status(401).json({
      codigo: 'CREDENCIALES_INVALIDAS',
      mensaje: 'Usuario o contraseña incorrectos',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const accessToken = generateToken('access');
  const refreshToken = generateToken('refresh');

  // Guardar sesión activa
  activeSessions.set(accessToken, {
    username: usuario.username,
    idCliente: usuario.idCliente,
    rol: usuario.rol,
    expiresAt: Date.now() + 900000 // 15 minutos
  });

  activeSessions.set(refreshToken, {
    username: usuario.username,
    idCliente: usuario.idCliente,
    rol: usuario.rol,
    type: 'refresh',
    accessToken: accessToken,
    expiresAt: Date.now() + 604800000 // 7 días
  });

  // Registrar evento de auditoría
  try {
    const auditoria = readData('auditoria.json');
    auditoria.push({
      idEvento: `EVT-${String(auditoria.length + 1).padStart(4, '0')}`,
      usuario: usuario.username,
      tipoEvento: 'LOGIN',
      descripcion: 'Inicio de sesión exitoso',
      fecha: new Date().toISOString()
    });
    writeData('auditoria.json', auditoria);
  } catch (e) { /* silently continue */ }

  res.json({
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken,
    refreshExpiresIn: 604800,
    scope: 'transferencias cuentas perfil'
  });
}

/**
 * Renueva access token usando refresh token
 */
function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'refreshToken es requerido',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const session = activeSessions.get(refreshToken);

  if (!session || session.type !== 'refresh' || session.expiresAt < Date.now()) {
    activeSessions.delete(refreshToken);
    return res.status(401).json({
      codigo: 'TOKEN_EXPIRADO',
      mensaje: 'El refresh token ha expirado o es inválido',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Invalidar access token anterior
  if (session.accessToken) {
    activeSessions.delete(session.accessToken);
  }

  // Generar nuevo access token
  const newAccessToken = generateToken('access');
  activeSessions.set(newAccessToken, {
    username: session.username,
    idCliente: session.idCliente,
    rol: session.rol,
    expiresAt: Date.now() + 900000
  });

  // Actualizar referencia en refresh token
  session.accessToken = newAccessToken;

  res.json({
    accessToken: newAccessToken,
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken,
    refreshExpiresIn: Math.floor((session.expiresAt - Date.now()) / 1000),
    scope: 'transferencias cuentas perfil'
  });
}

/**
 * Cierra sesión invalidando refresh token
 */
function logout(req, res) {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const session = activeSessions.get(refreshToken);
    if (session && session.accessToken) {
      activeSessions.delete(session.accessToken);
    }
    activeSessions.delete(refreshToken);
  }

  res.status(204).send();
}

/**
 * Middleware de autenticación - valida Bearer token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      codigo: 'NO_AUTORIZADO',
      mensaje: 'Token de autorización requerido',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);

  if (!session || session.type === 'refresh') {
    return res.status(401).json({
      codigo: 'TOKEN_INVALIDO',
      mensaje: 'El token proporcionado es inválido',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  if (session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    return res.status(401).json({
      codigo: 'TOKEN_EXPIRADO',
      mensaje: 'El token ha expirado',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: req.requestId
    });
  }

  // Attach user info to request
  req.user = {
    username: session.username,
    idCliente: session.idCliente,
    rol: session.rol
  };

  next();
}

// Exportar sesiones activas para testing
module.exports = { login, refresh, logout, authMiddleware, activeSessions, generateToken };
