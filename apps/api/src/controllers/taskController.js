const service = require('../services/taskService');
const { httpError } = require('../utils/httpError');

function getTasks(req, res, next) {
  try {
    res.json(service.listTasks(req.query));
  } catch (error) {
    next(error);
  }
}

function getTaskById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Task id must be an integer');
    res.json(service.getTaskById(id));
  } catch (error) {
    next(error);
  }
}

function createTask(req, res, next) {
  try {
    const created = service.createTask(req.body, req.user.id);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateTask(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Task id must be an integer');
    const updated = service.updateTask(id, req.body, req.user.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

function deleteTask(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Task id must be an integer');
    service.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { getTasks, getTaskById, createTask, updateTask, deleteTask };
