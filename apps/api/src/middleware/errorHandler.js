const { logger } = require('../utils/logger');

function normalizeDatabaseError(err, req) {
  const message = String(err?.message || '');

  if (/FOREIGN KEY constraint failed/i.test(message)) {
    if (req.method === 'DELETE') {
      err.status = 409;
      err.code = 'foreign_key_conflict';
      err.expose = true;
      err.message = 'Resource cannot be deleted because dependent records exist';
      return err;
    }

    err.status = 400;
    err.code = 'foreign_key_invalid';
    err.expose = true;
    err.message = 'One or more referenced records do not exist';
    return err;
  }

  if (/UNIQUE constraint failed/i.test(message)) {
    err.status = 409;
    err.code = 'unique_constraint';
    err.expose = true;
    err.message = 'A conflicting record already exists';
    return err;
  }

  return err;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const normalizedError = Number.isInteger(err.status) ? err : normalizeDatabaseError(err, req);
  const status =
    Number.isInteger(normalizedError.status)
      ? normalizedError.status
      : normalizedError instanceof SyntaxError
        ? 400
        : 500;
  const requestId = req.requestId || 'unknown';
  const message =
    normalizedError.clientMessage ||
    (status >= 500 && normalizedError.expose !== true
      ? 'Internal server error'
      : normalizedError.message || 'Request could not be processed');
  const level = status >= 500 ? 'error' : 'warn';

  logger[level]('Request failed', {
    request_id: requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    status,
    error_code: normalizedError.code || null,
    error_source: normalizedError.source || null,
    error: normalizedError
  });

  res.status(status).json({
    message,
    request_id: requestId,
    code: normalizedError.code || undefined
  });
}

module.exports = { errorHandler };
