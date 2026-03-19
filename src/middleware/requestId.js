let requestCounter = 0;

/**
 * Middleware que asigna un ID único a cada request
 */
function requestIdMiddleware(req, res, next) {
  requestCounter++;
  req.requestId = `req-${String(requestCounter).padStart(6, '0')}`;
  next();
}

module.exports = requestIdMiddleware;
