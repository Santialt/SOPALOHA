const { logger } = require('../utils/logger');

function getClientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/, '');
}

function requestContext(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    logger[level]('HTTP request completed', {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status,
      duration_ms: Math.round(durationMs * 100) / 100,
      ip: getClientIp(req),
      user_agent: req.headers['user-agent'] || null
    });
  });

  next();
}

module.exports = { requestContext };
