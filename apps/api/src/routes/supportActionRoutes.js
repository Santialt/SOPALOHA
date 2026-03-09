const express = require('express');
const controller = require('../controllers/supportActionController');
const { requireSensitiveAccess } = require('../middleware/security');

const router = express.Router();

router.post('/ping', requireSensitiveAccess, controller.pingDevice);
router.post('/teamviewer/open', requireSensitiveAccess, controller.openTeamviewer);

module.exports = router;
