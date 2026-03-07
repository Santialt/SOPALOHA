const express = require('express');
const controller = require('../controllers/onCallShiftController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const shiftRules = [
  { field: 'title', required: true },
  { field: 'assigned_to', required: true },
  {
    field: 'start_at',
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/,
    patternDescription: 'YYYY-MM-DD o YYYY-MM-DDTHH:MM'
  },
  {
    field: 'end_at',
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/,
    patternDescription: 'YYYY-MM-DD o YYYY-MM-DDTHH:MM'
  }
];

router.get('/', controller.getShifts);
router.get('/current', controller.getCurrentShift);
router.get('/:id', controller.getShiftById);
router.post('/', validateBody(shiftRules), controller.createShift);
router.put('/:id', validateBody(shiftRules), controller.updateShift);

module.exports = router;
