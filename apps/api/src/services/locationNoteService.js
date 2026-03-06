const repository = require('../repositories/locationNoteRepository');
const { httpError } = require('../utils/httpError');

function listLocationNotes() {
  return repository.findAll();
}

function createLocationNote(payload) {
  return repository.create(payload);
}

function deleteLocationNote(id) {
  const removed = repository.remove(id);
  if (!removed) throw httpError(404, 'Location note not found');
}

module.exports = { listLocationNotes, createLocationNote, deleteLocationNote };
