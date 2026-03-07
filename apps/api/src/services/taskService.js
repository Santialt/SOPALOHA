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

function normalizePayload(payload, existing = {}) {
  return {
    title: String(payload.title ?? existing.title ?? '').trim(),
    description: isBlank(payload.description) ? null : String(payload.description),
    location_id: toNullableInteger(payload.location_id ?? existing.location_id),
    device_id: toNullableInteger(payload.device_id ?? existing.device_id),
    incident_id: toNullableInteger(payload.incident_id ?? existing.incident_id),
    status: payload.status || existing.status || 'pending',
    priority: payload.priority || existing.priority || 'medium',
    assigned_to: isBlank(payload.assigned_to) ? null : String(payload.assigned_to).trim(),
    due_date: isBlank(payload.due_date) ? null : String(payload.due_date),
    scheduled_for: isBlank(payload.scheduled_for) ? null : String(payload.scheduled_for),
    task_type: isBlank(payload.task_type) ? (existing.task_type || 'general') : String(payload.task_type).trim()
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
}

function listTasks(filters = {}) {
  validateFilters(filters);

  return repository.findAll({
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

function createTask(payload) {
  const normalized = normalizePayload(payload);
  if (!normalized.title) {
    throw httpError(400, 'Field title is required');
  }

  return repository.create(normalized);
}

function updateTask(id, payload) {
  const existing = repository.findById(id);
  if (!existing) throw httpError(404, 'Task not found');

  const normalized = normalizePayload(payload, existing);
  if (!normalized.title) {
    throw httpError(400, 'Field title is required');
  }

  return repository.update(id, normalized);
}

function deleteTask(id) {
  const removed = repository.remove(id);
  if (!removed) throw httpError(404, 'Task not found');
}

module.exports = {
  allowedStatuses,
  allowedPriorities,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
