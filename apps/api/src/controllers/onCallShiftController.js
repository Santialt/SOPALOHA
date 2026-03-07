const service = require('../services/onCallShiftService');
const { httpError } = require('../utils/httpError');

function getShifts(req, res, next) {
  try {
    res.json(service.listShifts());
  } catch (error) {
    next(error);
  }
}

function getShiftById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Shift id must be an integer');
    res.json(service.getShiftById(id));
  } catch (error) {
    next(error);
  }
}

function getCurrentShift(req, res, next) {
  try {
    res.json(service.getCurrentShift());
  } catch (error) {
    next(error);
  }
}

function createShift(req, res, next) {
  try {
    const created = service.createShift(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateShift(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Shift id must be an integer');
    const updated = service.updateShift(id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getShifts,
  getShiftById,
  getCurrentShift,
  createShift,
  updateShift
};
