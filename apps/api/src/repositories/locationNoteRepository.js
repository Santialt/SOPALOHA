const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM location_notes ORDER BY created_at DESC, id DESC').all();
}

function create(payload) {
  const stmt = db.prepare('INSERT INTO location_notes (location_id, note) VALUES (?, ?)');
  const result = stmt.run(payload.location_id, payload.note);
  return db.prepare('SELECT * FROM location_notes WHERE id = ?').get(result.lastInsertRowid);
}

function remove(id) {
  const result = db.prepare('DELETE FROM location_notes WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, create, remove };
