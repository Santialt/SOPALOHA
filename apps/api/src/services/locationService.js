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

function normalizeLocationPayload(payload) {
  return {
    ...payload,
    usa_nbo: toBoolean(payload.usa_nbo)
  };
}

function listLocations() {
  return repository.findAll();
}

function searchLocations(query) {
  const normalized = String(query || '').trim();
  if (!normalized) return [];
  return repository.search(normalized, 10);
}

function getLocation(id) {
  const row = repository.findById(id);
  if (!row) throw httpError(404, 'Location not found');
  return row;
}

function createLocation(payload) {
  return repository.create(normalizeLocationPayload(payload));
}

function updateLocation(id, payload) {
  getLocation(id);
  return repository.update(id, normalizeLocationPayload(payload));
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
