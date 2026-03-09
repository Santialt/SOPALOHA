function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err.status) ? err.status : err instanceof SyntaxError ? 400 : 500;
  const requestId = req.requestId || 'unknown';
  const isServerError = status >= 500;

  if (isServerError) {
    console.error(`[${requestId}]`, err.stack || err.message || err);
  } else {
    console.warn(`[${requestId}] ${err.message || 'Request error'}`);
  }

  res.status(status).json({
    message:
      status >= 500
        ? 'Internal server error'
        : err.message || 'Request could not be processed',
    request_id: requestId
  });
}

module.exports = { errorHandler };
