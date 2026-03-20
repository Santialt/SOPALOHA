const { logger } = require('../utils/logger');
const {
  getDirectRemoteAddress,
  getRequestRemoteAddress,
  hasForwardedHeaders
} = require('./security');

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
      user_id: req.user?.id || null,
      ip: getRequestRemoteAddress(req) || null,
      direct_ip: getDirectRemoteAddress(req) || null,
      forwarded_for_chain: hasForwardedHeaders(req)
        ? String(req.headers['x-forwarded-for'] || '').trim() || null
        : null,
      user_agent: req.headers['user-agent'] || null
    });
  });

  next();
}

module.exports = { requestContext };
