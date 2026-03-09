const repository = require('../repositories/deviceRepository');
const { httpError } = require('../utils/httpError');
const { sanitizeDevice, sanitizeDeviceList } = require('../utils/sanitizeDevice');

const DEVICE_ROLE_VALUES = new Set([
  'server',
  'pos',
  'kitchen_display',
  'kitchen_printer',
  'fiscal_printer',
  'router',
  'switch',
  'other'
]);

const LEGACY_TYPE_TO_ROLE = {
  server: 'server',
  pos_terminal: 'pos',
  fiscal_printer: 'fiscal_printer',
  kitchen_printer: 'kitchen_printer',
  pinpad: 'other',
  router: 'router',
  switch: 'switch',
  other: 'other'
};

const ROLE_TO_LEGACY_TYPE = {
  server: 'server',
  pos: 'pos_terminal',
  kitchen_display: 'other',
  kitchen_printer: 'kitchen_printer',
  fiscal_printer: 'fiscal_printer',
  router: 'router',
  switch: 'switch',
  other: 'other'
};

function normalizeDevicePayload(payload) {
  const roleFromPayload = DEVICE_ROLE_VALUES.has(payload.device_role) ? payload.device_role : null;
  const roleFromLegacyType = LEGACY_TYPE_TO_ROLE[payload.type] || null;
  const deviceRole = roleFromPayload || roleFromLegacyType || 'other';
  const type = payload.type || ROLE_TO_LEGACY_TYPE[deviceRole] || 'other';

  return {
    ...payload,
    type,
    device_role: deviceRole,
    ram_gb:
      payload.ram_gb === '' || payload.ram_gb === undefined || payload.ram_gb === null
        ? null
        : Number(payload.ram_gb)
  };
}

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

function listDevices(filters = {}) {
  return sanitizeDeviceList(repository.findAll(normalizeListFilters(filters)));
}

function getDevice(id) {
  const row = repository.findById(id);
  if (!row) throw httpError(404, 'Device not found');
  return sanitizeDevice(row);
}

function createDevice(payload) {
  return sanitizeDevice(repository.create(normalizeDevicePayload(payload)));
}

function updateDevice(id, payload) {
  getDevice(id);
  return sanitizeDevice(repository.update(id, normalizeDevicePayload(payload)));
}

function deleteDevice(id) {
  getDevice(id);
  repository.remove(id);
}

module.exports = { listDevices, getDevice, createDevice, updateDevice, deleteDevice };
