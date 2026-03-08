const repository = require('../repositories/onCallTemplateRepository');
const { httpError } = require('../utils/httpError');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback ? 1 : 0;
  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return 1;
  return 0;
}

function normalizePayload(payload, existing = {}) {
  return {
    title: String(payload.title ?? existing.title ?? '').trim(),
    start_time: String(payload.start_time ?? existing.start_time ?? '').trim(),
    end_time: String(payload.end_time ?? existing.end_time ?? '').trim(),
    crosses_to_next_day: normalizeBoolean(
      payload.crosses_to_next_day,
      Boolean(existing.crosses_to_next_day)
    )
  };
}

function validateTemplate(template) {
  if (!template.title) throw httpError(400, 'Field title is required');
  if (isBlank(template.start_time)) throw httpError(400, 'Field start_time is required');
  if (isBlank(template.end_time)) throw httpError(400, 'Field end_time is required');

  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timePattern.test(template.start_time)) {
    throw httpError(400, 'start_time must use HH:MM format');
  }
  if (!timePattern.test(template.end_time)) {
    throw httpError(400, 'end_time must use HH:MM format');
  }

  if (template.start_time === template.end_time && template.crosses_to_next_day !== 1) {
    throw httpError(400, 'If start_time equals end_time, crosses_to_next_day must be true');
  }
}

function listTemplates() {
  return repository.findAll();
}

function getTemplateById(id) {
  const template = repository.findById(id);
  if (!template) throw httpError(404, 'On-call template not found');
  return template;
}

function createTemplate(payload) {
  const normalized = normalizePayload(payload);
  validateTemplate(normalized);
  return repository.create(normalized);
}

function updateTemplate(id, payload) {
  const existing = repository.findById(id);
  if (!existing) throw httpError(404, 'On-call template not found');
  const normalized = normalizePayload(payload, existing);
  validateTemplate(normalized);
  return repository.update(id, normalized);
}

module.exports = { listTemplates, getTemplateById, createTemplate, updateTemplate };
