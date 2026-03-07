const express = require('express');
const controller = require('../controllers/teamviewerImportController');

const router = express.Router();

router.get('/import-preview', controller.getImportPreview);
router.post('/import', controller.postImport);

module.exports = router;
