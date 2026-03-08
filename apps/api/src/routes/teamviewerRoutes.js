const express = require('express');
const controller = require('../controllers/teamviewerImportController');
const explorerController = require('../controllers/teamviewerExplorerController');
const importedCaseController = require('../controllers/teamviewerImportedCaseController');

const router = express.Router();

router.get('/explorer', explorerController.getExplorer);
router.get('/groups/:groupId', explorerController.getGroup);
router.get('/devices/:teamviewerId', explorerController.getDevice);
router.get('/import-preview', controller.getImportPreview);
router.post('/import', controller.postImport);
router.post('/import-cases', importedCaseController.importCases);
router.get('/imported-cases', importedCaseController.listImportedCases);
router.post('/imported-cases', importedCaseController.createManualImportedCase);
router.get('/imported-cases/:id', importedCaseController.getImportedCaseById);
router.delete('/imported-cases/:id', importedCaseController.deleteImportedCase);

module.exports = router;
