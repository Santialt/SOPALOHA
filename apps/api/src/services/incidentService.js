const repository = require('../repositories/incidentRepository');
const { httpError } = require('../utils/httpError');

function listIncidents() {
  return repository.findAll();
}

function getIncident(id) {
  const row = repository.findById(id);
  if (!row) throw httpError(404, 'Incident not found');
  return row;
}

function createIncident(payload) {
  return repository.create(payload);
}

function updateIncident(id, payload) {
  getIncident(id);
  return repository.update(id, payload);
}

function deleteIncident(id) {
  getIncident(id);
  repository.remove(id);
}

module.exports = { listIncidents, getIncident, createIncident, updateIncident, deleteIncident };
