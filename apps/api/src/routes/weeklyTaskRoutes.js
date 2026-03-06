const express = require('express');
const controller = require('../controllers/weeklyTaskController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const weeklyTaskRules = [
  { field: 'location_id', type: 'integer' },
  { field: 'title', required: true },
  { field: 'priority', allowedValues: ['low', 'medium', 'high', 'urgent'] },
  { field: 'status', allowedValues: ['todo', 'in_progress', 'blocked', 'done'] },
  { field: 'due_date', pattern: /^\d{4}-\d{2}-\d{2}$/, patternDescription: 'YYYY-MM-DD' }
];

router.get('/', controller.getWeeklyTasks);
router.post('/', validateBody(weeklyTaskRules), controller.createWeeklyTask);
router.put('/:id', validateBody(weeklyTaskRules), controller.updateWeeklyTask);
router.delete('/:id', controller.deleteWeeklyTask);

module.exports = router;
