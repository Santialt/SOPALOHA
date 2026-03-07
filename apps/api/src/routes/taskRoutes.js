const express = require('express');
const controller = require('../controllers/taskController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const taskRules = [
  { field: 'title', required: true },
  { field: 'location_id', type: 'integer' },
  { field: 'device_id', type: 'integer' },
  { field: 'incident_id', type: 'integer' },
  { field: 'status', allowedValues: ['pending', 'in_progress', 'blocked', 'done', 'cancelled'] },
  { field: 'priority', allowedValues: ['low', 'medium', 'high', 'critical'] },
  { field: 'due_date', pattern: /^\d{4}-\d{2}-\d{2}$/, patternDescription: 'YYYY-MM-DD' },
  {
    field: 'scheduled_for',
    pattern: /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/,
    patternDescription: 'YYYY-MM-DD o YYYY-MM-DDTHH:MM'
  }
];

router.get('/', controller.getTasks);
router.get('/:id', controller.getTaskById);
router.post('/', validateBody(taskRules), controller.createTask);
router.put('/:id', validateBody(taskRules), controller.updateTask);

module.exports = router;
