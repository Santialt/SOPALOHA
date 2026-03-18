const db = require('../db/connection');

const shiftSelect = `
  SELECT
    on_call_shifts.*,
    principal_user.name AS assigned_user_name,
    backup_user.name AS backup_assigned_user_name,
    COALESCE(principal_user.name, on_call_shifts.assigned_to) AS assigned_to,
    COALESCE(backup_user.name, on_call_shifts.backup_assigned_to) AS backup_assigned_to
  FROM on_call_shifts
  LEFT JOIN users principal_user ON principal_user.id = on_call_shifts.assigned_user_id
  LEFT JOIN users backup_user ON backup_user.id = on_call_shifts.backup_assigned_user_id
`;

function findAll() {
  return db
    .prepare(
      `
      ${shiftSelect}
      ORDER BY start_at ASC, id ASC
    `
    )
    .all();
}

function findById(id) {
  return db
    .prepare(
      `
      ${shiftSelect}
      WHERE on_call_shifts.id = ?
    `
    )
    .get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO on_call_shifts (
      title,
      assigned_user_id,
      assigned_to,
      backup_assigned_user_id,
      backup_assigned_to,
      start_at,
      end_at,
      notes
    ) VALUES (
      @title,
      @assigned_user_id,
      @assigned_to,
      @backup_assigned_user_id,
      @backup_assigned_to,
      @start_at,
      @end_at,
      @notes
    )
  `);

  const result = stmt.run({
    title: payload.title,
    assigned_user_id: payload.assigned_user_id,
    assigned_to: payload.assigned_to,
    backup_assigned_user_id: payload.backup_assigned_user_id,
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
        assigned_user_id = @assigned_user_id,
        assigned_to = @assigned_to,
        backup_assigned_user_id = @backup_assigned_user_id,
        backup_assigned_to = @backup_assigned_to,
        start_at = @start_at,
        end_at = @end_at,
        notes = @notes
      WHERE id = @id
    `
  ).run({
    id,
    title: payload.title,
    assigned_user_id: payload.assigned_user_id,
    assigned_to: payload.assigned_to,
    backup_assigned_user_id: payload.backup_assigned_user_id,
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
