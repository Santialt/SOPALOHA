const express = require('express');
const controller = require('../controllers/supportActionController');
const { requireRole } = require('../middleware/auth');
const { requireApiKey } = require('../middleware/security');

const router = express.Router();

router.post('/ping', requireRole('admin'), requireApiKey, controller.pingDevice);
router.post('/teamviewer/open', requireRole('admin'), requireApiKey, controller.openTeamviewer);

module.exports = router;
