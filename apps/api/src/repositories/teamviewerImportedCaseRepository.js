const db = require('../db/connection');

function findAll(filters = {}) {
  const where = [];
  const params = {};
  const resolvedLocationJoin = `
    LEFT JOIN locations explicit_location ON explicit_location.id = teamviewer_imported_cases.location_id
    LEFT JOIN locations matched_location
      ON teamviewer_imported_cases.location_id IS NULL
      AND lower(trim(coalesce(matched_location.name, ''))) = lower(trim(coalesce(teamviewer_imported_cases.teamviewer_group_name, '')))
  `;
  const resolvedLocationIdExpr = 'coalesce(teamviewer_imported_cases.location_id, matched_location.id)';
  const resolvedLocationNameExpr =
    "coalesce(explicit_location.name, matched_location.name, teamviewer_imported_cases.teamviewer_group_name)";

  if (filters.from_date) {
    where.push('started_at >= @from_date');
    params.from_date = filters.from_date;
  }

  if (filters.to_date) {
    where.push('started_at <= @to_date');
    params.to_date = filters.to_date;
  }

  if (filters.location_id) {
    where.push(`${resolvedLocationIdExpr} = @location_id`);
    params.location_id = filters.location_id;
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

  if (filters.keyword) {
    where.push("(lower(coalesce(problem_description, '')) LIKE lower(@keyword_like) OR lower(coalesce(requested_by, '')) LIKE lower(@keyword_like) OR lower(coalesce(note_raw, '')) LIKE lower(@keyword_like))");
    params.keyword_like = `%${filters.keyword}%`;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Number.isInteger(filters.limit) ? filters.limit : null;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;

  if (limit) {
    params.limit = limit;
    params.offset = offset;
  }

  return db
    .prepare(
      `
      SELECT
        teamviewer_imported_cases.*,
        ${resolvedLocationIdExpr} AS resolved_location_id,
        ${resolvedLocationNameExpr} AS resolved_location_name
      FROM teamviewer_imported_cases
      ${resolvedLocationJoin}
      ${whereSql}
      ORDER BY started_at DESC, id DESC
      ${limit ? 'LIMIT @limit OFFSET @offset' : ''}
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
