const db = require('../db/connection');

function findAll() {
  return db
    .prepare(
      `
      SELECT *
      FROM on_call_shifts
      ORDER BY start_at ASC, id ASC
    `
    )
    .all();
}

function findById(id) {
  return db.prepare('SELECT * FROM on_call_shifts WHERE id = ?').get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO on_call_shifts (
      title,
      assigned_to,
      backup_assigned_to,
      start_at,
      end_at,
      notes
    ) VALUES (
      @title,
      @assigned_to,
      @backup_assigned_to,
      @start_at,
      @end_at,
      @notes
    )
  `);

  const result = stmt.run({
    title: payload.title,
    assigned_to: payload.assigned_to,
    backup_assigned_to: payload.backup_assigned_to,
    start_at: payload.start_at,
    end_at: payload.end_at,
    notes: payload.notes
  });

  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  db.prepare(
    `
      UPDATE on_call_shifts
      SET
        title = @title,
        assigned_to = @assigned_to,
        backup_assigned_to = @backup_assigned_to,
        start_at = @start_at,
        end_at = @end_at,
        notes = @notes
      WHERE id = @id
    `
  ).run({
    id,
    title: payload.title,
    assigned_to: payload.assigned_to,
    backup_assigned_to: payload.backup_assigned_to,
    start_at: payload.start_at,
    end_at: payload.end_at,
    notes: payload.notes
  });

  return findById(id);
}

function remove(id) {
  const result = db.prepare('DELETE FROM on_call_shifts WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, findById, create, update, remove };
