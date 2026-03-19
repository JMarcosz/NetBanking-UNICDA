/**
 * Middleware de control de acceso basado en roles
 * @param  {...string} roles - Roles permitidos (CLIENTE, ADMIN_BANCO, AUDITOR)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        codigo: 'NO_AUTORIZADO',
        mensaje: 'Autenticación requerida',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId
      });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        codigo: 'ACCESO_DENEGADO',
        mensaje: 'No tiene permisos suficientes para acceder a este recurso',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId
      });
    }

    next();
  };
}

module.exports = { requireRole };
