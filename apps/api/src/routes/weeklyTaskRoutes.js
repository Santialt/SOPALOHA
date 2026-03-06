const express = require('express');
const controller = require('../controllers/weeklyTaskController');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', controller.getWeeklyTasks);
router.post('/', requireFields(['title']), controller.createWeeklyTask);
router.put('/:id', requireFields(['title']), controller.updateWeeklyTask);
router.delete('/:id', controller.deleteWeeklyTask);

module.exports = router;
