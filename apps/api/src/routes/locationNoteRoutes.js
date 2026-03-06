const express = require('express');
const controller = require('../controllers/locationNoteController');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', controller.getLocationNotes);
router.post('/', requireFields(['location_id', 'note']), controller.createLocationNote);
router.delete('/:id', controller.deleteLocationNote);

module.exports = router;
