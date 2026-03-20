const { httpError } = require('../utils/httpError');
const { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } = require('../utils/authSession');
const userRepository = require('../repositories/userRepository');

function toSafeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: Boolean(user.active),
    login_enabled: Boolean(user.login_enabled),
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

function attachAuth(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    req.user = null;
    return next();
  }

  const payload = verifySessionToken(token);
  if (!payload?.sub) {
    req.user = null;
    return next();
  }

  const user = userRepository.findById(Number(payload.sub));
  if (!user || !user.active || !user.login_enabled) {
    req.user = null;
    return next();
  }

  req.user = toSafeUser(user);
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return next(httpError(401, 'Authentication required'));
  }

  return next();
}

function requireRole(role) {
  const allowedRoles = role === 'tech' ? new Set(['tech', 'admin']) : new Set([role]);

  return (req, res, next) => {
    if (!req.user) {
      return next(httpError(401, 'Authentication required'));
    }

    if (!allowedRoles.has(req.user.role)) {
      return next(httpError(403, 'Forbidden'));
    }

    return next();
  };
}

module.exports = { attachAuth, requireAuth, requireRole, toSafeUser };
