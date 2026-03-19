const repository = require('../repositories/locationRepository');
const { httpError } = require('../utils/httpError');
const deviceService = require('./deviceService');
const incidentService = require('./incidentService');
const taskService = require('./taskService');
const locationNoteService = require('./locationNoteService');

function toBoolean(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  return false;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeDate(value) {
  if (isBlank(value)) return null;
  return String(value).trim();
}

function normalizeInteger(value) {
  if (isBlank(value)) return null;
  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? numericValue : null;
}

function normalizeString(value) {
  if (isBlank(value)) return null;
  return String(value).trim();
}

function normalizeStatusForStorage(value) {
  if (value === 'cerrado' || value === 'inactive') return 'inactive';
  return 'active';
}

function normalizeStatusForResponse(value) {
  if (value === 'inactive' || value === 'cerrado') return 'cerrado';
  return 'abierto';
}

function mapLocationForResponse(row) {
  if (!row) return row;

  return {
    ...row,
    status: normalizeStatusForResponse(row.status),
    usa_nbo: Boolean(row.usa_nbo),
    tiene_kitchen: Boolean(row.tiene_kitchen),
    usa_insight_pulse: Boolean(row.usa_insight_pulse),
    terminales: Number(row.terminales) || 0,
    integrations: String(row.integrations_catalog || '')
      .split('||')
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

function normalizeLocationPayload(payload, existingLocation = null) {
  const status = normalizeStatusForStorage(payload.status ?? existingLocation?.status);
  const fechaApertura =
    payload.fecha_apertura === undefined
      ? normalizeDate(existingLocation?.fecha_apertura)
      : normalizeDate(payload.fecha_apertura);
  const fechaCierreBase =
    payload.fecha_cierre === undefined
      ? normalizeDate(existingLocation?.fecha_cierre)
      : normalizeDate(payload.fecha_cierre);

  return {
    ...payload,
    usa_nbo: toBoolean(payload.usa_nbo),
    tiene_kitchen: toBoolean(payload.tiene_kitchen),
    usa_insight_pulse: toBoolean(payload.usa_insight_pulse),
    cantidad_licencias_aloha: normalizeInteger(payload.cantidad_licencias_aloha),
    country: normalizeString(payload.country),
    fecha_apertura: fechaApertura,
    fecha_cierre: status === 'active' ? null : fechaCierreBase,
    status
  };
}

function listLocations() {
  return repository.findAll().map(mapLocationForResponse);
}

function searchLocations(query) {
  const normalized = String(query || '').trim();
  if (!normalized) return [];
  return repository.search(normalized, 10);
}

function getLocation(id) {
  const row = repository.findById(id);
  if (!row) throw httpError(404, 'Location not found');
  return mapLocationForResponse(row);
}

function createLocation(payload) {
  return mapLocationForResponse(repository.create(normalizeLocationPayload(payload)));
}

function updateLocation(id, payload) {
  const existingLocation = repository.findById(id);
  if (!existingLocation) throw httpError(404, 'Location not found');

  return mapLocationForResponse(repository.update(id, normalizeLocationPayload(payload, existingLocation)));
}

function deleteLocation(id) {
  getLocation(id);
  repository.remove(id);
}

function listLocationIntegrations(locationId) {
  getLocation(locationId);
  return repository.findIntegrationsByLocationId(locationId);
}

function replaceLocationIntegrations(locationId, integrationNames) {
  getLocation(locationId);
  if (!Array.isArray(integrationNames)) {
    throw httpError(400, "Field 'integrations' must be an array");
  }

  return repository.replaceIntegrations(locationId, integrationNames);
}

function listLocationDevices(locationId, filters = {}) {
  getLocation(locationId);
  return deviceService.listDevices({ ...filters, location_id: locationId });
}

function listLocationIncidents(locationId, filters = {}) {
  getLocation(locationId);
  return incidentService.listIncidents({ ...filters, location_id: locationId });
}

function listLocationTasks(locationId, filters = {}) {
  getLocation(locationId);
  return taskService.listTasks({ ...filters, location_id: locationId });
}

function listLocationNotes(locationId, filters = {}) {
  getLocation(locationId);
  return locationNoteService.listLocationNotes({ ...filters, location_id: locationId });
}

module.exports = {
  listLocations,
  searchLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  listLocationIntegrations,
  replaceLocationIntegrations,
  listLocationDevices,
  listLocationIncidents,
  listLocationTasks,
  listLocationNotes
};
