const express = require('express');
const controller = require('../controllers/onCallShiftController');
const { requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const shiftRules = [
  { field: 'title', required: true },
  { field: 'assigned_user_id', type: 'integer' },
  { field: 'assigned_to' },
  { field: 'backup_assigned_user_id', type: 'integer' },
  { field: 'backup_assigned_to' },
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
  },
  { field: 'notes' }
];

router.get('/', controller.getShifts);
router.get('/current', controller.getCurrentShift);
router.get('/:id', controller.getShiftById);
router.post('/', requireRole('admin'), validateBody(shiftRules), controller.createShift);
router.put('/:id', requireRole('admin'), validateBody(shiftRules), controller.updateShift);
router.delete('/:id', requireRole('admin'), controller.deleteShift);

module.exports = router;
