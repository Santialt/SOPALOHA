const repository = require('../repositories/weeklyTaskRepository');
const { httpError } = require('../utils/httpError');

function listWeeklyTasks() {
  return repository.findAll();
}

function createWeeklyTask(payload) {
  return repository.create(payload);
}

function updateWeeklyTask(id, payload) {
  const existing = repository.findById(id);
  if (!existing) throw httpError(404, 'Weekly task not found');
  return repository.update(id, payload);
}

function deleteWeeklyTask(id) {
  const removed = repository.remove(id);
  if (!removed) throw httpError(404, 'Weekly task not found');
}

module.exports = { listWeeklyTasks, createWeeklyTask, updateWeeklyTask, deleteWeeklyTask };
