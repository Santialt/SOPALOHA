const express = require('express');
const controller = require('../controllers/teamviewerImportController');
const explorerController = require('../controllers/teamviewerExplorerController');
const importedCaseController = require('../controllers/teamviewerImportedCaseController');
const { requireRole } = require('../middleware/auth');
const { requireApiKey } = require('../middleware/security');

const router = express.Router();
const requireAdmin = requireRole('admin');

router.use(requireAdmin);
router.use(requireApiKey);

router.get('/explorer', explorerController.getExplorer);
router.get('/groups/:groupId', explorerController.getGroup);
router.get('/devices/:teamviewerId', explorerController.getDevice);
router.get('/locations/:locationId/device-statuses', explorerController.getLocationDeviceStatuses);
router.get('/import-preview', controller.getImportPreview);
router.post('/import', requireAdmin, requireApiKey, controller.postImport);
router.post('/import-cases', requireAdmin, requireApiKey, importedCaseController.importCases);
router.get('/imported-cases/catalogs', importedCaseController.listImportedCaseCatalogs);
router.get('/imported-cases', importedCaseController.listImportedCases);
router.post('/imported-cases', requireAdmin, requireApiKey, importedCaseController.createManualImportedCase);
router.get('/imported-cases/:id', importedCaseController.getImportedCaseById);
router.delete('/imported-cases/:id', requireAdmin, requireApiKey, importedCaseController.deleteImportedCase);

module.exports = router;
