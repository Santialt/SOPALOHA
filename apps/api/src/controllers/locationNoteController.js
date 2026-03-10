const service = require('../services/locationNoteService');

function getLocationNotes(req, res, next) {
  try {
    res.json(service.listLocationNotes(req.query || {}));
  } catch (error) {
    next(error);
  }
}

function createLocationNote(req, res, next) {
  try {
    const created = service.createLocationNote(req.body, req.user.id);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

function deleteLocationNote(req, res, next) {
  try {
    service.deleteLocationNote(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { getLocationNotes, createLocationNote, deleteLocationNote };
