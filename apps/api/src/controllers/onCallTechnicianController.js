const service = require('../services/onCallTechnicianService');
const { httpError } = require('../utils/httpError');

function getTechnicians(req, res, next) {
  try {
    res.json(service.listTechnicians());
  } catch (error) {
    next(error);
  }
}

function getTechnicianById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Technician id must be an integer');
    res.json(service.getTechnicianById(id));
  } catch (error) {
    next(error);
  }
}

function createTechnician(req, res, next) {
  try {
    const created = service.createTechnician(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateTechnician(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Technician id must be an integer');
    const updated = service.updateTechnician(id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

module.exports = { getTechnicians, getTechnicianById, createTechnician, updateTechnician };
