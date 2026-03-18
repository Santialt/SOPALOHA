const userRepository = require('../repositories/userRepository');
const repository = require('../repositories/taskRepository');
const { httpError } = require('../utils/httpError');

const allowedStatuses = ['pending', 'in_progress', 'blocked', 'done', 'cancelled'];
const allowedPriorities = ['low', 'medium', 'high', 'critical'];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function toNullableInteger(value) {
  if (isBlank(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function hasOwn(payload, field) {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

function normalizePayload(payload, existing = {}) {
  const hasAssignedUserId = hasOwn(payload, 'assigned_user_id');
  const requestedAssignedUserId = hasAssignedUserId ? payload.assigned_user_id : existing.assigned_user_id;
  const assignedUserId = toNullableInteger(requestedAssignedUserId);
  const assignedUser = assignedUserId ? userRepository.findById(assignedUserId) : null;

  if (
    hasAssignedUserId &&
    !isBlank(payload.assigned_user_id) &&
    assignedUserId &&
    (!assignedUser || !assignedUser.active)
  ) {
    throw httpError(400, 'Assigned user is invalid or inactive');
  }

  const hasLegacyAssignedTo = hasOwn(payload, 'assigned_to');
  let assignedTo;
  if (assignedUser?.active) {
    assignedTo = assignedUser.name;
  } else if (hasLegacyAssignedTo) {
    assignedTo = isBlank(payload.assigned_to) ? null : String(payload.assigned_to).trim();
  } else if (hasAssignedUserId) {
    assignedTo = assignedUserId === null ? null : existing.assigned_to ?? null;
  } else {
    assignedTo = existing.assigned_to ?? null;
  }

  return {
    title: String(payload.title ?? existing.title ?? '').trim(),
    description: isBlank(payload.description) ? null : String(payload.description),
    location_id: toNullableInteger(payload.location_id ?? existing.location_id),
    // Legacy compatibility: keep the stored device link unless an API client still sends it explicitly.
    device_id: hasOwn(payload, 'device_id')
      ? toNullableInteger(payload.device_id)
      : toNullableInteger(existing.device_id),
    // Legacy compatibility: keep the stored incident link unless an API client still sends it explicitly.
    incident_id: hasOwn(payload, 'incident_id')
      ? toNullableInteger(payload.incident_id)
      : toNullableInteger(existing.incident_id),
    status: payload.status || existing.status || 'pending',
    priority: payload.priority || existing.priority || 'medium',
    // Legacy compatibility: preserve historical text assignments when the active UI omits the field.
    assigned_to: assignedTo,
    assigned_user_id: assignedUserId,
    due_date: isBlank(payload.due_date) ? null : String(payload.due_date),
    scheduled_for: isBlank(payload.scheduled_for) ? null : String(payload.scheduled_for),
    // Legacy compatibility: keep stored task_type unless an older client still sends it.
    task_type: hasOwn(payload, 'task_type')
      ? (isBlank(payload.task_type) ? 'general' : String(payload.task_type).trim())
      : existing.task_type || 'general'
  };
}

function validateFilters(filters) {
  if (filters.status && !allowedStatuses.includes(filters.status)) {
    throw httpError(400, `Invalid status filter. Allowed: ${allowedStatuses.join(', ')}`);
  }

  if (filters.priority && !allowedPriorities.includes(filters.priority)) {
    throw httpError(400, `Invalid priority filter. Allowed: ${allowedPriorities.join(', ')}`);
  }

  if (!isBlank(filters.location_id) && !Number.isInteger(Number(filters.location_id))) {
    throw httpError(400, 'location_id filter must be an integer');
  }

  if (!isBlank(filters.limit)) {
    const limit = Number(filters.limit);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw httpError(400, 'limit filter must be a positive integer');
    }
  }

  if (!isBlank(filters.offset)) {
    const offset = Number(filters.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw httpError(400, 'offset filter must be a non-negative integer');
    }
  }
}

function listTasks(filters = {}) {
  validateFilters(filters);

  return repository.findAll({
    status: filters.status || null,
    priority: filters.priority || null,
    location_id: isBlank(filters.location_id) ? null : Number(filters.location_id),
    limit: isBlank(filters.limit) ? null : Math.min(Number(filters.limit), 200),
    offset: isBlank(filters.offset) ? 0 : Number(filters.offset)
  });
}

function countTasks(filters = {}) {
  validateFilters(filters);

  return repository.countAll({
    status: filters.status || null,
    priority: filters.priority || null,
    location_id: isBlank(filters.location_id) ? null : Number(filters.location_id)
  });
}

function getTaskById(id) {
  const task = repository.findById(id);
  if (!task) throw httpError(404, 'Task not found');
  return task;
}

function createTask(payload, actorId) {
  const normalized = normalizePayload(payload);
  if (!normalized.title) {
    throw httpError(400, 'Field title is required');
  }

  return repository.create({ ...normalized, created_by: actorId, updated_by: actorId });
}

function updateTask(id, payload, actorId) {
  const existing = repository.findById(id);
  if (!existing) throw httpError(404, 'Task not found');

  const normalized = normalizePayload(payload, existing);
  if (!normalized.title) {
    throw httpError(400, 'Field title is required');
  }

  return repository.update(id, { ...normalized, updated_by: actorId });
}

function deleteTask(id) {
  const removed = repository.remove(id);
  if (!removed) throw httpError(404, 'Task not found');
}

module.exports = {
  allowedStatuses,
  allowedPriorities,
  listTasks,
  countTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
