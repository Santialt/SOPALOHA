const userRepository = require('../repositories/userRepository');
const { httpError } = require('../utils/httpError');
const { hashPassword } = require('../utils/passwords');
const { toSafeUser } = require('../middleware/auth');

const allowedRoles = ['admin', 'tech'];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeActive(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1') {
    return true;
  }

  if (value === false || value === 0 || String(value).toLowerCase() === 'false' || String(value) === '0') {
    return false;
  }

  throw httpError(400, 'Field active must be a boolean');
}

function ensureUniqueEmail(email, userIdToIgnore = null) {
  const existing = userRepository.findByEmail(email);
  if (existing && existing.id !== userIdToIgnore) {
    throw httpError(409, 'Email already exists');
  }
}

function validateRole(role) {
  if (!allowedRoles.includes(role)) {
    throw httpError(400, `Invalid role. Allowed: ${allowedRoles.join(', ')}`);
  }
}

function listUsers(filters = {}) {
  const normalized = {};
  if (!isBlank(filters.search)) normalized.search = String(filters.search).trim();
  if (!isBlank(filters.role)) {
    validateRole(filters.role);
    normalized.role = filters.role;
  }
  if (!isBlank(filters.active)) normalized.active = normalizeActive(filters.active);
  return userRepository.findAll(normalized);
}

function listAssignableUsers() {
  return userRepository.findAssignable();
}

function getUserById(id) {
  const user = userRepository.findById(id);
  if (!user) throw httpError(404, 'User not found');
  return toSafeUser(user);
}

function createUser(payload) {
  const name = String(payload.name || '').trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const role = String(payload.role || 'tech').trim();
  const active = normalizeActive(payload.active, true);

  if (!name) throw httpError(400, 'Field name is required');
  if (!email) throw httpError(400, 'Field email is required');
  if (!password.trim()) throw httpError(400, 'Field password is required');
  validateRole(role);
  ensureUniqueEmail(email);

  const created = userRepository.create({
    name,
    email,
    password_hash: hashPassword(password),
    role,
    active
  });

  return toSafeUser(created);
}

function updateUser(id, payload, actor) {
  const existing = userRepository.findById(id);
  if (!existing) throw httpError(404, 'User not found');

  const name = isBlank(payload.name) ? existing.name : String(payload.name).trim();
  const email = isBlank(payload.email) ? existing.email : normalizeEmail(payload.email);
  const role = isBlank(payload.role) ? existing.role : String(payload.role).trim();
  const active =
    payload.active === undefined ? Boolean(existing.active) : normalizeActive(payload.active, Boolean(existing.active));
  const passwordHash = isBlank(payload.password)
    ? existing.password_hash
    : hashPassword(String(payload.password));

  if (!name) throw httpError(400, 'Field name is required');
  if (!email) throw httpError(400, 'Field email is required');
  validateRole(role);
  ensureUniqueEmail(email, id);

  if (actor?.id === id && role !== 'admin') {
    throw httpError(400, 'You cannot remove your own admin role');
  }

  if (actor?.id === id && !active) {
    throw httpError(400, 'You cannot deactivate your own account');
  }

  if (existing.role === 'admin' && role !== 'admin' && userRepository.countAdmins() <= 1) {
    throw httpError(400, 'At least one active admin is required');
  }

  if (existing.role === 'admin' && existing.active && !active && userRepository.countAdmins() <= 1) {
    throw httpError(400, 'At least one active admin is required');
  }

  return toSafeUser(
    userRepository.update(id, {
      name,
      email,
      password_hash: passwordHash,
      role,
      active
    })
  );
}

function updateUserActive(id, active, actor) {
  const existing = userRepository.findById(id);
  if (!existing) throw httpError(404, 'User not found');

  const normalizedActive = normalizeActive(active, Boolean(existing.active));

  if (actor?.id === id && !normalizedActive) {
    throw httpError(400, 'You cannot deactivate your own account');
  }

  if (existing.role === 'admin' && existing.active && !normalizedActive && userRepository.countAdmins() <= 1) {
    throw httpError(400, 'At least one active admin is required');
  }

  return toSafeUser(userRepository.updateActive(id, normalizedActive));
}

module.exports = {
  allowedRoles,
  createUser,
  getUserById,
  listAssignableUsers,
  listUsers,
  updateUser,
  updateUserActive
};
