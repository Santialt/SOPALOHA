const crypto = require('crypto');
const { URL } = require('url');
const { httpError } = require('../utils/httpError');

const warnedMissingApiKey = { value: false };
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];

function getRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString('hex');
}

function parseAllowedOrigins() {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function normalizeRemoteAddress(value) {
  return String(value || '').replace(/^::ffff:/, '');
}

function isPrivateIpv4(value) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return false;
  }

  const octets = value.split('.').map(Number);
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  if (octets[0] === 10) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;

  return false;
}

function isLoopbackOrPrivateAddress(value) {
  const normalized = normalizeRemoteAddress(value);
  return normalized === '::1' || normalized === 'localhost' || isPrivateIpv4(normalized);
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return isLoopbackOrPrivateAddress(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function setSecurityHeaders(req, res, next) {
  req.requestId = req.headers['x-request-id'] || getRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

function corsMiddleware() {
  const allowedOrigins = parseAllowedOrigins();

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (origin && !isAllowedOrigin(origin, allowedOrigins)) {
      if (req.method === 'OPTIONS') {
        return res.sendStatus(403);
      }

      return next(httpError(403, 'Origin not allowed'));
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Internal-Api-Key, X-Request-Id'
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  };
}

function hasValidApiKey(req) {
  const configuredApiKey = String(process.env.INTERNAL_API_KEY || '').trim();

  if (!configuredApiKey) {
    if (!warnedMissingApiKey.value) {
      console.warn('[Security] INTERNAL_API_KEY is not configured. Falling back to private-network-only access.');
      warnedMissingApiKey.value = true;
    }

    return null;
  }

  const presentedApiKey =
    String(req.headers['x-internal-api-key'] || '').trim() ||
    String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

  if (!presentedApiKey) {
    return false;
  }

  const expected = Buffer.from(configuredApiKey);
  const actual = Buffer.from(presentedApiKey);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function requireInternalAccess(req, res, next) {
  const apiKeyStatus = hasValidApiKey(req);
  const remoteAddress = req.socket?.remoteAddress;

  if (apiKeyStatus === true) {
    return next();
  }

  if (apiKeyStatus === null && isLoopbackOrPrivateAddress(remoteAddress)) {
    return next();
  }

  return next(httpError(401, 'Unauthorized internal API request'));
}

function requireSensitiveAccess(req, res, next) {
  const remoteAddress = req.socket?.remoteAddress;
  const apiKeyStatus = hasValidApiKey(req);

  if (!isLoopbackOrPrivateAddress(remoteAddress)) {
    return next(httpError(403, 'Sensitive action is allowed only from the internal network'));
  }

  if (apiKeyStatus === false) {
    return next(httpError(401, 'Sensitive action requires a valid internal API key'));
  }

  return next();
}

module.exports = {
  corsMiddleware,
  requireInternalAccess,
  requireSensitiveAccess,
  setSecurityHeaders,
  isPrivateIpv4,
  isLoopbackOrPrivateAddress
};
