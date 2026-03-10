const commentService = require('../services/commentService');
const { httpError } = require('../utils/httpError');

function parseEntityId(value) {
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw httpError(400, 'Entity id must be an integer');
  }
  return id;
}

function listIncidentComments(req, res, next) {
  try {
    res.json(commentService.listComments('incident', parseEntityId(req.params.id)));
  } catch (error) {
    next(error);
  }
}

function createIncidentComment(req, res, next) {
  try {
    const created = commentService.createComment('incident', parseEntityId(req.params.id), req.body, req.user);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function listTaskComments(req, res, next) {
  try {
    res.json(commentService.listComments('task', parseEntityId(req.params.id)));
  } catch (error) {
    next(error);
  }
}

function createTaskComment(req, res, next) {
  try {
    const created = commentService.createComment('task', parseEntityId(req.params.id), req.body, req.user);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createIncidentComment,
  createTaskComment,
  listIncidentComments,
  listTaskComments
};
