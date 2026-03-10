const express = require('express');
const controller = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/login',
  validateBody([
    { field: 'email', required: true },
    { field: 'password', required: true }
  ]),
  controller.login
);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
