const express = require('express');
const controller = require('../controllers/supportActionController');

const router = express.Router();

router.post('/ping', controller.pingDevice);
router.post('/teamviewer/open', controller.openTeamviewer);

module.exports = router;
