const repository = require('../repositories/onCallShiftRepository');
const userRepository = require('../repositories/userRepository');
const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeDateTime(value) {
  if (isBlank(value)) return '';
  return String(value).trim().replace(' ', 'T');
}

function normalizeOptionalInteger(value, fallbackValue = null) {
  if (value === undefined) return fallbackValue;
  if (value === null || value === '') return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw httpError(400, 'assigned_user_id and backup_assigned_user_id must be positive integers');
  }

  return parsed;
}

function parseDateTime(value) {
  if (!value) return null;

  let normalized = String(value);
  if (normalized.includes(' ')) normalized = normalized.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized = `${normalized}T00:00:00`;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getAssignableOnCallUser(userId, fieldName) {
  if (userId === null) return null;

  const user = userRepository.findById(userId);
  if (!user || !user.active || user.role !== 'tech') {
    throw httpError(400, `${fieldName} is invalid or inactive`);
  }

  return user;
}

function normalizePayload(payload, existing = {}) {
  const assignedUserId = normalizeOptionalInteger(payload.assigned_user_id, existing.assigned_user_id ?? null);
  const backupAssignedUserId = normalizeOptionalInteger(
    payload.backup_assigned_user_id,
    existing.backup_assigned_user_id ?? null
  );
  const assignedUser = getAssignableOnCallUser(assignedUserId, 'assigned_user_id');
  const backupAssignedUser = getAssignableOnCallUser(
    backupAssignedUserId,
    'backup_assigned_user_id'
  );
  const fallbackAssignedTo = String(payload.assigned_to ?? existing.assigned_to ?? '').trim();
  const fallbackBackupAssignedTo = isBlank(payload.backup_assigned_to)
    ? null
    : String(payload.backup_assigned_to).trim();

  return {
    title: String(payload.title ?? existing.title ?? '').trim(),
    assigned_user_id: assignedUser ? assignedUser.id : null,
    assigned_to: assignedUser ? assignedUser.name : fallbackAssignedTo,
    backup_assigned_user_id: backupAssignedUser ? backupAssignedUser.id : null,
    backup_assigned_to: backupAssignedUser ? backupAssignedUser.name : fallbackBackupAssignedTo,
    start_at: normalizeDateTime(payload.start_at ?? existing.start_at),
    end_at: normalizeDateTime(payload.end_at ?? existing.end_at),
    notes: isBlank(payload.notes) ? null : String(payload.notes).trim()
  };
}

function validateShift(shift) {
  if (!shift.title) throw httpError(400, 'Field title is required');
  if (!shift.assigned_to) {
    throw httpError(400, 'Either assigned_user_id or assigned_to is required');
  }
  if (!shift.start_at) throw httpError(400, 'Field start_at is required');
  if (!shift.end_at) throw httpError(400, 'Field end_at is required');
  if (shift.backup_assigned_user_id && shift.backup_assigned_user_id === shift.assigned_user_id) {
    throw httpError(400, 'backup_assigned_user_id must be different from assigned_user_id');
  }
  if (
    shift.backup_assigned_to &&
    shift.assigned_to &&
    shift.backup_assigned_to.trim().toLowerCase() === shift.assigned_to.trim().toLowerCase()
  ) {
    throw httpError(400, 'Backup assignee must be different from the primary assignee');
  }

  const start = parseDateTime(shift.start_at);
  const end = parseDateTime(shift.end_at);
  if (!start || !end) {
    throw httpError(400, 'start_at and end_at must be valid datetime values');
  }

  if (start.getTime() >= end.getTime()) {
    throw httpError(400, 'start_at must be earlier than end_at');
  }
}

function listShifts() {
  return repository.findAll();
}

function getShiftById(id) {
  const shift = repository.findById(id);
  if (!shift) throw httpError(404, 'On-call shift not found');
  return shift;
}

function createShift(payload) {
  const normalized = normalizePayload(payload);
  validateShift(normalized);
  return repository.create(normalized);
}

function updateShift(id, payload) {
  const existing = repository.findById(id);
  if (!existing) throw httpError(404, 'On-call shift not found');

  const normalized = normalizePayload(payload, existing);
  validateShift(normalized);
  return repository.update(id, normalized);
}

function deleteShift(id) {
  const removed = repository.remove(id);
  if (!removed) throw httpError(404, 'On-call shift not found');
}

function getCurrentShift(nowValue = new Date()) {
  const now = nowValue.getTime();

  const active = repository
    .findAll()
    .map((shift) => {
      const start = parseDateTime(shift.start_at);
      const end = parseDateTime(shift.end_at);
      return { shift, start, end };
    })
    .filter((item) => item.start && item.end)
    .filter((item) => item.start.getTime() <= now && item.end.getTime() >= now)
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  return active.length > 0 ? active[0].shift : null;
}

module.exports = {
  listShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getCurrentShift
};
