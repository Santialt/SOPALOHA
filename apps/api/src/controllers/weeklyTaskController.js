const service = require('../services/weeklyTaskService');

function getWeeklyTasks(req, res, next) {
  try {
    res.json(service.listWeeklyTasks());
  } catch (error) {
    next(error);
  }
}

function createWeeklyTask(req, res, next) {
  try {
    const created = service.createWeeklyTask(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateWeeklyTask(req, res, next) {
  try {
    const updated = service.updateWeeklyTask(Number(req.params.id), req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

function deleteWeeklyTask(req, res, next) {
  try {
    service.deleteWeeklyTask(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { getWeeklyTasks, createWeeklyTask, updateWeeklyTask, deleteWeeklyTask };
