function httpError(status, message, options = {}) {
  const err = new Error(message, options.cause ? { cause: options.cause } : undefined);
  err.status = status;
  err.code = options.code || null;
  err.expose = options.expose ?? status < 500;
  err.clientMessage = options.clientMessage || null;
  err.details = options.details || null;
  err.source = options.source || null;
  err.retryable = Boolean(options.retryable);
  return err;
}

module.exports = { httpError };
