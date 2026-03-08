const service = require('../services/onCallTemplateService');
const { httpError } = require('../utils/httpError');

function getTemplates(req, res, next) {
  try {
    res.json(service.listTemplates());
  } catch (error) {
    next(error);
  }
}

function getTemplateById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Template id must be an integer');
    res.json(service.getTemplateById(id));
  } catch (error) {
    next(error);
  }
}

function createTemplate(req, res, next) {
  try {
    const created = service.createTemplate(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function updateTemplate(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(400, 'Template id must be an integer');
    const updated = service.updateTemplate(id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

module.exports = { getTemplates, getTemplateById, createTemplate, updateTemplate };
