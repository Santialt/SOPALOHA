const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM on_call_technicians ORDER BY is_active DESC, name ASC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM on_call_technicians WHERE id = ?').get(id);
}

function create(payload) {
  const result = db
    .prepare(
      `
      INSERT INTO on_call_technicians (name, is_active, notes)
      VALUES (@name, @is_active, @notes)
    `
    )
    .run({
      name: payload.name,
      is_active: payload.is_active,
      notes: payload.notes
    });

  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  db.prepare(
    `
      UPDATE on_call_technicians
      SET
        name = @name,
        is_active = @is_active,
        notes = @notes
      WHERE id = @id
    `
  ).run({
    id,
    name: payload.name,
    is_active: payload.is_active,
    notes: payload.notes
  });

  return findById(id);
}

module.exports = { findAll, findById, create, update };
