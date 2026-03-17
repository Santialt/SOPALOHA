const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'sopaloha_session';
let cachedSessionSecret = null;

function requireSessionSecret() {
  if (cachedSessionSecret) {
    return cachedSessionSecret;
  }

  const configured = String(process.env.AUTH_SESSION_SECRET || '').trim();
  if (!configured) {
    throw new Error('AUTH_SESSION_SECRET must be defined');
  }

  cachedSessionSecret = configured;
  return cachedSessionSecret;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function sign(value) {
  return crypto
    .createHmac('sha256', requireSessionSecret())
    .update(value)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createSessionToken(user, maxAgeSeconds = 60 * 60 * 12) {
  const payload = {
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  const [payloadPart, signaturePart] = String(token || '').split('.');
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = sign(payloadPart);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signaturePart);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || '');
  return cookieHeader.split(';').reduce((acc, chunk) => {
    const [name, ...rest] = chunk.trim().split('=');
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function buildCookieValue(value, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function setSessionCookie(res, token, maxAgeSeconds = 60 * 60 * 12) {
  res.setHeader('Set-Cookie', buildCookieValue(token, maxAgeSeconds));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', buildCookieValue('', 0));
}

module.exports = {
  SESSION_COOKIE_NAME,
  requireSessionSecret,
  clearSessionCookie,
  createSessionToken,
  parseCookies,
  setSessionCookie,
  verifySessionToken
};
