const repository = require('../repositories/deviceRepository');
const { httpError } = require('../utils/httpError');

function listDevices() {
  return repository.findAll();
}

function getDevice(id) {
  const row = repository.findById(id);
  if (!row) throw httpError(404, 'Device not found');
  return row;
}

function createDevice(payload) {
  return repository.create(payload);
}

function updateDevice(id, payload) {
  getDevice(id);
  return repository.update(id, payload);
}

function deleteDevice(id) {
  getDevice(id);
  repository.remove(id);
}

module.exports = { listDevices, getDevice, createDevice, updateDevice, deleteDevice };
