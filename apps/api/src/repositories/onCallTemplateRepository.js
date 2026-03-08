const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM on_call_templates ORDER BY title ASC, id ASC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM on_call_templates WHERE id = ?').get(id);
}

function create(payload) {
  const result = db
    .prepare(
      `
      INSERT INTO on_call_templates (title, start_time, end_time, crosses_to_next_day)
      VALUES (@title, @start_time, @end_time, @crosses_to_next_day)
    `
    )
    .run({
      title: payload.title,
      start_time: payload.start_time,
      end_time: payload.end_time,
      crosses_to_next_day: payload.crosses_to_next_day
    });

  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  db.prepare(
    `
      UPDATE on_call_templates
      SET
        title = @title,
        start_time = @start_time,
        end_time = @end_time,
        crosses_to_next_day = @crosses_to_next_day
      WHERE id = @id
    `
  ).run({
    id,
    title: payload.title,
    start_time: payload.start_time,
    end_time: payload.end_time,
    crosses_to_next_day: payload.crosses_to_next_day
  });

  return findById(id);
}

module.exports = { findAll, findById, create, update };
