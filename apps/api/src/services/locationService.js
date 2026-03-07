const repository = require('../repositories/locationRepository');
const { httpError } = require('../utils/httpError');

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

module.exports = {
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  listLocationIntegrations,
  replaceLocationIntegrations
};
