const service = require('../services/deviceService');

function getDevices(req, res, next) {
  try {
    res.json(service.listDevices());
  } catch (error) {
    next(error);
  }
}

function getDeviceById(req, res, next) {
  try {
    res.json(service.getDevice(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

function createDevice(req, res, next) {
  try {
    const created = service.createDevice(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateDevice(req, res, next) {
  try {
    const updated = service.updateDevice(Number(req.params.id), req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

function deleteDevice(req, res, next) {
  try {
    service.deleteDevice(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { getDevices, getDeviceById, createDevice, updateDevice, deleteDevice };
