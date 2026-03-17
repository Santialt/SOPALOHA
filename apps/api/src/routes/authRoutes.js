const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();
const loginRateLimit = rateLimit({
  windowMs: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts, please try again later',
    code: 'RATE_LIMITED'
  }
});

router.post(
  '/login',
  loginRateLimit,
  validateBody([
    { field: 'email', required: true },
    { field: 'password', required: true }
  ]),
  controller.login
);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
