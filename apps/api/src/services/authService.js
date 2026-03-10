const userRepository = require('../repositories/userRepository');
const { httpError } = require('../utils/httpError');
const { verifyPassword } = require('../utils/passwords');
const { createSessionToken, clearSessionCookie, setSessionCookie } = require('../utils/authSession');
const { toSafeUser } = require('../middleware/auth');

function login(payload, res) {
  const email = String(payload?.email || '').trim().toLowerCase();
  const password = String(payload?.password || '');

  if (!email || !password) {
    throw httpError(400, 'Email and password are required');
  }

  const user = userRepository.findByEmail(email);
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    throw httpError(401, 'Invalid credentials');
  }

  const sessionToken = createSessionToken(user);
  setSessionCookie(res, sessionToken);

  return toSafeUser(user);
}

function logout(res) {
  clearSessionCookie(res);
}

module.exports = { login, logout };
