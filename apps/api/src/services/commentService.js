const commentRepository = require('../repositories/commentRepository');
const incidentRepository = require('../repositories/incidentRepository');
const taskRepository = require('../repositories/taskRepository');
const { httpError } = require('../utils/httpError');

const allowedEntityTypes = ['incident', 'task'];

function ensureEntityExists(entityType, entityId) {
  if (entityType === 'incident') {
    if (!incidentRepository.findById(entityId)) {
      throw httpError(404, 'Incident not found');
    }
    return;
  }

  if (entityType === 'task') {
    if (!taskRepository.findById(entityId)) {
      throw httpError(404, 'Task not found');
    }
    return;
  }

  throw httpError(400, 'Unsupported comment entity type');
}

function listComments(entityType, entityId) {
  if (!allowedEntityTypes.includes(entityType)) {
    throw httpError(400, 'Unsupported comment entity type');
  }

  ensureEntityExists(entityType, entityId);
  return commentRepository.findByEntity(entityType, entityId);
}

function createComment(entityType, entityId, payload, user) {
  if (!allowedEntityTypes.includes(entityType)) {
    throw httpError(400, 'Unsupported comment entity type');
  }

  ensureEntityExists(entityType, entityId);
  const comment = String(payload?.comment || '').trim();
  if (!comment) {
    throw httpError(400, 'Field comment is required');
  }

  return commentRepository.create({
    entity_type: entityType,
    entity_id: entityId,
    user_id: user.id,
    comment
  });
}

module.exports = { createComment, listComments };
