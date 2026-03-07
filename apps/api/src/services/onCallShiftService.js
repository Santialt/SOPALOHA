const repository = require('../repositories/onCallShiftRepository');
const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeDateTime(value) {
  if (isBlank(value)) return '';
  return String(value).trim().replace(' ', 'T');
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

function normalizePayload(payload, existing = {}) {
  return {
    title: String(payload.title ?? existing.title ?? '').trim(),
    assigned_to: String(payload.assigned_to ?? existing.assigned_to ?? '').trim(),
    backup_assigned_to: isBlank(payload.backup_assigned_to)
      ? null
      : String(payload.backup_assigned_to).trim(),
    start_at: normalizeDateTime(payload.start_at ?? existing.start_at),
    end_at: normalizeDateTime(payload.end_at ?? existing.end_at),
    notes: isBlank(payload.notes) ? null : String(payload.notes).trim()
  };
}

function validateShift(shift) {
  if (!shift.title) throw httpError(400, 'Field title is required');
  if (!shift.assigned_to) throw httpError(400, 'Field assigned_to is required');
  if (!shift.start_at) throw httpError(400, 'Field start_at is required');
  if (!shift.end_at) throw httpError(400, 'Field end_at is required');

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
  getCurrentShift
};
