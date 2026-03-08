const repository = require('../repositories/onCallTechnicianRepository');
const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback ? 1 : 0;
  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return 1;
  return 0;
}

function normalizePayload(payload, existing = {}) {
  return {
    name: String(payload.name ?? existing.name ?? '').trim(),
    is_active: normalizeBoolean(payload.is_active, existing.is_active !== 0),
    notes: isBlank(payload.notes) ? null : String(payload.notes).trim()
  };
}

function validateTechnician(tech) {
  if (!tech.name) throw httpError(400, 'Field name is required');
}

function listTechnicians() {
  return repository.findAll();
}

function getTechnicianById(id) {
  const tech = repository.findById(id);
  if (!tech) throw httpError(404, 'On-call technician not found');
  return tech;
}

function createTechnician(payload) {
  const normalized = normalizePayload(payload);
  validateTechnician(normalized);
  try {
    return repository.create(normalized);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      throw httpError(409, 'Technician name already exists');
    }
    throw error;
  }
}

function updateTechnician(id, payload) {
  const existing = repository.findById(id);
  if (!existing) throw httpError(404, 'On-call technician not found');
  const normalized = normalizePayload(payload, existing);
  validateTechnician(normalized);
  try {
    return repository.update(id, normalized);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      throw httpError(409, 'Technician name already exists');
    }
    throw error;
  }
}

module.exports = { listTechnicians, getTechnicianById, createTechnician, updateTechnician };
