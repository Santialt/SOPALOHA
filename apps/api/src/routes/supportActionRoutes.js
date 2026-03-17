const express = require('express');
const controller = require('../controllers/supportActionController');
const { requireRole } = require('../middleware/auth');
const { requireSensitiveAccess } = require('../middleware/security');

const router = express.Router();

router.post('/ping', requireRole('admin'), requireSensitiveAccess, controller.pingDevice);
router.post('/teamviewer/open', requireRole('admin'), requireSensitiveAccess, controller.openTeamviewer);

module.exports = router;
