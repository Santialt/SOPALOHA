const repository = require('../repositories/incidentRepository');
const { httpError } = require('../utils/httpError');

const allowedStatuses = ['open', 'closed'];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function parseDateRangeEdge(value, endOfDay) {
  const raw = String(value || '').trim();
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyPattern.test(raw)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    return new Date(`${raw}${suffix}`);
  }
  return new Date(raw);
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

  if (!isBlank(filters.device_id)) {
    const deviceId = Number(filters.device_id);
    if (!Number.isInteger(deviceId)) {
      throw httpError(400, 'device_id filter must be an integer');
    }
    normalized.device_id = deviceId;
  }

  if (!isBlank(filters.status)) {
    if (!allowedStatuses.includes(filters.status)) {
      throw httpError(400, `Invalid status filter. Allowed: ${allowedStatuses.join(', ')}`);
    }
    normalized.status = filters.status;
  }

  if (!isBlank(filters.search)) {
    normalized.search = String(filters.search).trim();
  }

  if (!isBlank(filters.from_date)) {
    const fromDate = parseDateRangeEdge(filters.from_date, false);
    if (Number.isNaN(fromDate.getTime())) {
      throw httpError(400, 'Invalid from_date filter');
    }
    normalized.from_date = fromDate.toISOString();
  }

  if (!isBlank(filters.to_date)) {
    const toDate = parseDateRangeEdge(filters.to_date, true);
    if (Number.isNaN(toDate.getTime())) {
      throw httpError(400, 'Invalid to_date filter');
    }
    normalized.to_date = toDate.toISOString();
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

function listIncidents(filters = {}) {
  return repository.findAll(normalizeListFilters(filters));
}

function countIncidents(filters = {}) {
  return repository.countAll(normalizeListFilters(filters));
}

function getIncident(id) {
  const row = repository.findById(id);
  if (!row) throw httpError(404, 'Incident not found');
  return row;
}

function createIncident(payload, actorId) {
  return repository.create({ ...payload, created_by: actorId, updated_by: actorId });
}

function updateIncident(id, payload, actorId) {
  getIncident(id);
  return repository.update(id, { ...payload, updated_by: actorId });
}

function deleteIncident(id) {
  getIncident(id);
  repository.remove(id);
}

module.exports = { listIncidents, countIncidents, getIncident, createIncident, updateIncident, deleteIncident };
