const userService = require('../services/userService');
const { httpError } = require('../utils/httpError');

function parseUserId(value) {
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw httpError(400, 'User id must be an integer');
  }
  return id;
}

function listUsers(req, res, next) {
  try {
    res.json(userService.listUsers(req.query || {}));
  } catch (error) {
    next(error);
  }
}

function listAssignableUsers(req, res, next) {
  try {
    res.json(userService.listAssignableUsers(req.query || {}));
  } catch (error) {
    next(error);
  }
}

function getUserById(req, res, next) {
  try {
    res.json(userService.getUserById(parseUserId(req.params.id)));
  } catch (error) {
    next(error);
  }
}

function createUser(req, res, next) {
  try {
    const created = userService.createUser(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateUser(req, res, next) {
  try {
    const updated = userService.updateUser(parseUserId(req.params.id), req.body, req.user);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

function updateUserActive(req, res, next) {
  try {
    const updated = userService.updateUserActive(parseUserId(req.params.id), req.body?.active, req.user);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

function enableUserLogin(req, res, next) {
  try {
    const updated = userService.enableUserLogin(
      parseUserId(req.params.id),
      req.body || {},
      req.user,
    );
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUser,
  enableUserLogin,
  getUserById,
  listAssignableUsers,
  listUsers,
  updateUser,
  updateUserActive
};
