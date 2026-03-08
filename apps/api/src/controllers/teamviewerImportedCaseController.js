const service = require('../services/teamviewerImportedCaseService');
const { httpError } = require('../utils/httpError');

async function importCases(req, res, next) {
  try {
    const result = await service.importCases(req.body || {});
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

function listImportedCases(req, res, next) {
  try {
    const rows = service.listImportedCases(req.query || {});
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

function getImportedCaseById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw httpError(400, 'Imported case id must be an integer');
    }
    const row = service.getImportedCaseById(id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

function createManualImportedCase(req, res, next) {
  try {
    const row = service.createManualImportedCase(req.body || {});
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

function deleteImportedCase(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw httpError(400, 'Imported case id must be an integer');
    }
    service.deleteImportedCase(id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  importCases,
  listImportedCases,
  getImportedCaseById,
  createManualImportedCase,
  deleteImportedCase
};
