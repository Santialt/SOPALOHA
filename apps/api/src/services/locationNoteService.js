const repository = require('../repositories/locationNoteRepository');
const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeListFilters(filters = {}) {
  const normalized = {};

  if (!isBlank(filters.location_id)) {
    const locationId = Number(filters.location_id);
    if (!Number.isInteger(locationId)) {
      throw httpError(400, 'location_id filter must be an integer');
    }
    normalized.location_id = locationId;
  }

  if (!isBlank(filters.limit)) {
    const limit = Number(filters.limit);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw httpError(400, 'limit filter must be a positive integer');
    }
    normalized.limit = Math.min(limit, 200);
  }

  if (!isBlank(filters.offset)) {
    const offset = Number(filters.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw httpError(400, 'offset filter must be a non-negative integer');
    }
    normalized.offset = offset;
  }

  return normalized;
}

function listLocationNotes(filters = {}) {
  return repository.findAll(normalizeListFilters(filters));
}

function createLocationNote(payload, actorId) {
  return repository.create({ ...payload, created_by: actorId, updated_by: actorId });
}

function deleteLocationNote(id) {
  const removed = repository.remove(id);
  if (!removed) throw httpError(404, 'Location note not found');
}

module.exports = { listLocationNotes, createLocationNote, deleteLocationNote };
