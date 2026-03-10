const db = require('../db/connection');

function findAll(filters = {}) {
  const where = [];
  const params = {};

  if (filters.location_id) {
    where.push('location_id = @location_id');
    params.location_id = filters.location_id;
  }

  const limit = Number.isInteger(filters.limit) ? filters.limit : null;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = limit ? 'LIMIT @limit OFFSET @offset' : '';

  if (limit) {
    params.limit = limit;
    params.offset = offset;
  }

  return db
    .prepare(
      `
      SELECT
        location_notes.*,
        creator.name AS created_by_name,
        updater.name AS updated_by_name
      FROM location_notes
      LEFT JOIN users creator ON creator.id = location_notes.created_by
      LEFT JOIN users updater ON updater.id = location_notes.updated_by
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      ${limitSql}
    `
    )
    .all(params);
}

function create(payload) {
  const stmt = db.prepare(
    'INSERT INTO location_notes (location_id, note, created_by, updated_by) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(payload.location_id, payload.note, payload.created_by ?? null, payload.updated_by ?? null);
  return db
    .prepare(
      `
      SELECT
        location_notes.*,
        creator.name AS created_by_name,
        updater.name AS updated_by_name
      FROM location_notes
      LEFT JOIN users creator ON creator.id = location_notes.created_by
      LEFT JOIN users updater ON updater.id = location_notes.updated_by
      WHERE location_notes.id = ?
    `
    )
    .get(result.lastInsertRowid);
}

function remove(id) {
  const result = db.prepare('DELETE FROM location_notes WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, create, remove };
