/**
 * Middleware global de manejo de errores
 */
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    codigo: err.codigo || 'ERROR_INTERNO',
    mensaje: err.message || 'Ha ocurrido un error interno del servidor',
    detalles: err.detalles || null,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    requestId: req.requestId
  });
}

module.exports = errorHandler;
