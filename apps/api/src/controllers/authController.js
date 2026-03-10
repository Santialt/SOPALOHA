const authService = require('../services/authService');

function login(req, res, next) {
  try {
    const user = authService.login(req.body, res);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

function logout(req, res, next) {
  try {
    authService.logout(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  res.json(req.user);
}

module.exports = { login, logout, me };
