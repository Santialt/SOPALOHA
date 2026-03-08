const db = require('../db/connection');

function findAll(filters = {}) {
  const where = [];
  const params = {};

  if (filters.from_date) {
    where.push('started_at >= @from_date');
    params.from_date = filters.from_date;
  }

  if (filters.to_date) {
    where.push('started_at <= @to_date');
    params.to_date = filters.to_date;
  }

  if (filters.group) {
    where.push('lower(teamviewer_group_name) LIKE lower(@group_like)');
    params.group_like = `%${filters.group}%`;
  }

  if (filters.technician) {
    where.push(
      '(lower(coalesce(technician_username, \'\')) LIKE lower(@technician_like) OR lower(coalesce(technician_display_name, \'\')) LIKE lower(@technician_like))'
    );
    params.technician_like = `%${filters.technician}%`;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .prepare(
      `
      SELECT *
      FROM teamviewer_imported_cases
      ${whereSql}
      ORDER BY started_at DESC, id DESC
    `
    )
    .all(params);
}

function findById(id) {
  return db.prepare('SELECT * FROM teamviewer_imported_cases WHERE id = ?').get(id);
}

function create(payload) {
  const result = db
    .prepare(
      `
      INSERT INTO teamviewer_imported_cases (
        external_connection_id,
        started_at,
        ended_at,
        duration_seconds,
        technician_username,
        technician_display_name,
        teamviewer_group_name,
        note_raw,
        problem_description,
        requested_by,
        location_id,
        linked_incident_id,
        raw_payload_json
      ) VALUES (
        @external_connection_id,
        @started_at,
        @ended_at,
        @duration_seconds,
        @technician_username,
        @technician_display_name,
        @teamviewer_group_name,
        @note_raw,
        @problem_description,
        @requested_by,
        @location_id,
        @linked_incident_id,
        @raw_payload_json
      )
    `
    )
    .run(payload);

  return findById(result.lastInsertRowid);
}

function remove(id) {
  const result = db.prepare('DELETE FROM teamviewer_imported_cases WHERE id = ?').run(id);
  return result.changes > 0;
}

function insertMany(rows) {
  const insertStmt = db.prepare(
    `
      INSERT OR IGNORE INTO teamviewer_imported_cases (
        external_connection_id,
        started_at,
        ended_at,
        duration_seconds,
        technician_username,
        technician_display_name,
        teamviewer_group_name,
        note_raw,
        problem_description,
        requested_by,
        location_id,
        linked_incident_id,
        raw_payload_json
      ) VALUES (
        @external_connection_id,
        @started_at,
        @ended_at,
        @duration_seconds,
        @technician_username,
        @technician_display_name,
        @teamviewer_group_name,
        @note_raw,
        @problem_description,
        @requested_by,
        @location_id,
        @linked_incident_id,
        @raw_payload_json
      )
    `
  );

  const run = db.transaction((entries) => {
    let inserted = 0;
    let duplicated = 0;

    for (const entry of entries) {
      const result = insertStmt.run(entry);
      if (result.changes > 0) {
        inserted += 1;
      } else {
        duplicated += 1;
      }
    }

    return { inserted, duplicated };
  });

  return run(rows);
}

module.exports = {
  findAll,
  findById,
  create,
  remove,
  insertMany
};
