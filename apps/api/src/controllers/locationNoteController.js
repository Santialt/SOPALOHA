const { httpError } = require('../utils/httpError');

function getLocationNotes(req, res, next) {
  try {
    next(httpError(410, 'Location notes module is disabled'));
  } catch (error) {
    next(error);
  }
}

function createLocationNote(req, res, next) {
  try {
    next(httpError(410, 'Location notes module is disabled'));
  } catch (error) {
    next(error);
  }
}

function deleteLocationNote(req, res, next) {
  try {
    next(httpError(410, 'Location notes module is disabled'));
  } catch (error) {
    next(error);
  }
}

module.exports = { getLocationNotes, createLocationNote, deleteLocationNote };
