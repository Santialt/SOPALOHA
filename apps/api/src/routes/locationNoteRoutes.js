const express = require('express');
const controller = require('../controllers/locationNoteController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const locationNoteRules = [
  { field: 'location_id', required: true, type: 'integer' },
  { field: 'note', required: true }
];

router.get('/', controller.getLocationNotes);
router.post('/', validateBody(locationNoteRules), controller.createLocationNote);
router.delete('/:id', controller.deleteLocationNote);

module.exports = router;
