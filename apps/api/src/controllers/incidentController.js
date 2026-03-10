const service = require('../services/incidentService');

function getIncidents(req, res, next) {
  try {
    res.json(service.listIncidents(req.query || {}));
  } catch (error) {
    next(error);
  }
}

function getIncidentById(req, res, next) {
  try {
    res.json(service.getIncident(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

function createIncident(req, res, next) {
  try {
    const created = service.createIncident(req.body, req.user.id);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateIncident(req, res, next) {
  try {
    const updated = service.updateIncident(Number(req.params.id), req.body, req.user.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

function deleteIncident(req, res, next) {
  try {
    service.deleteIncident(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { getIncidents, getIncidentById, createIncident, updateIncident, deleteIncident };
