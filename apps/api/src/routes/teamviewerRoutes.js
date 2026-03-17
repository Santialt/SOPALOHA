const express = require('express');
const controller = require('../controllers/teamviewerImportController');
const explorerController = require('../controllers/teamviewerExplorerController');
const importedCaseController = require('../controllers/teamviewerImportedCaseController');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const requireAdmin = requireRole('admin');

router.get('/explorer', explorerController.getExplorer);
router.get('/groups/:groupId', explorerController.getGroup);
router.get('/devices/:teamviewerId', explorerController.getDevice);
router.get('/import-preview', controller.getImportPreview);
router.post('/import', requireAdmin, controller.postImport);
router.post('/import-cases', requireAdmin, importedCaseController.importCases);
router.get('/imported-cases', importedCaseController.listImportedCases);
router.post('/imported-cases', requireAdmin, importedCaseController.createManualImportedCase);
router.get('/imported-cases/:id', importedCaseController.getImportedCaseById);
router.delete('/imported-cases/:id', requireAdmin, importedCaseController.deleteImportedCase);

module.exports = router;
