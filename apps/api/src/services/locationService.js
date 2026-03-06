const repository = require('../repositories/locationRepository');
const { httpError } = require('../utils/httpError');

function listLocations() {
  return repository.findAll();
}

function getLocation(id) {
  const row = repository.findById(id);
  if (!row) throw httpError(404, 'Location not found');
  return row;
}

function createLocation(payload) {
  return repository.create(payload);
}

function updateLocation(id, payload) {
  getLocation(id);
  return repository.update(id, payload);
}

function deleteLocation(id) {
  getLocation(id);
  repository.remove(id);
}

module.exports = { listLocations, getLocation, createLocation, updateLocation, deleteLocation };
