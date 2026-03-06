const express = require('express');
const controller = require('../controllers/teamviewerConnectionController');

const router = express.Router();

router.get('/', controller.listTeamviewerConnections);

module.exports = router;
