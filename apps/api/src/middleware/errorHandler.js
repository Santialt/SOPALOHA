const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err.status) ? err.status : err instanceof SyntaxError ? 400 : 500;
  const requestId = req.requestId || 'unknown';
  const message =
    status >= 500 && err.expose !== true
      ? 'Internal server error'
      : err.message || 'Request could not be processed';
  const level = status >= 500 ? 'error' : 'warn';

  logger[level]('Request failed', {
    request_id: requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    status,
    error_code: err.code || null,
    error_source: err.source || null,
    error: err
  });

  res.status(status).json({
    message,
    request_id: requestId,
    code: err.code || undefined
  });
}

module.exports = { errorHandler };
