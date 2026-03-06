const service = require('../services/locationService');

function getLocations(req, res, next) {
  try {
    res.json(service.listLocations());
  } catch (error) {
    next(error);
  }
}

function getLocationById(req, res, next) {
  try {
    res.json(service.getLocation(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

function createLocation(req, res, next) {
  try {
    const created = service.createLocation(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateLocation(req, res, next) {
  try {
    const updated = service.updateLocation(Number(req.params.id), req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

function deleteLocation(req, res, next) {
  try {
    service.deleteLocation(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { getLocations, getLocationById, createLocation, updateLocation, deleteLocation };
