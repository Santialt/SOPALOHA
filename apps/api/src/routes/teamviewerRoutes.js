const express = require('express');
const controller = require('../controllers/teamviewerImportController');
const explorerController = require('../controllers/teamviewerExplorerController');

const router = express.Router();

router.get('/explorer', explorerController.getExplorer);
router.get('/groups/:groupId', explorerController.getGroup);
router.get('/devices/:teamviewerId', explorerController.getDevice);
router.get('/import-preview', controller.getImportPreview);
router.post('/import', controller.postImport);

module.exports = router;
