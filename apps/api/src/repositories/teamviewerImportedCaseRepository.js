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
    where.push('lower(trim(teamviewer_group_name)) = lower(trim(@group_name))');
    params.group_name = filters.group;
  }

  if (filters.technician_user_id) {
    where.push(
      `(
        teamviewer_imported_cases.technician_user_id = @technician_user_id
        OR (
          teamviewer_imported_cases.technician_user_id IS NULL
          AND (
            lower(trim(coalesce(teamviewer_imported_cases.technician_display_name, ''))) = lower(trim(@technician_name))
            OR lower(trim(coalesce(teamviewer_imported_cases.technician_username, ''))) = lower(trim(@technician_email))
          )
        )
      )`
    );
    params.technician_user_id = filters.technician_user_id;
    params.technician_name = filters.technician_name || '';
    params.technician_email = filters.technician_email || '';
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
        technician_user.name AS technician_user_name,
        technician_user.email AS technician_user_email,
        technician_user.role AS technician_user_role,
        ${resolvedLocationIdExpr} AS resolved_location_id,
        ${resolvedLocationNameExpr} AS resolved_location_name
      FROM teamviewer_imported_cases
      LEFT JOIN users technician_user ON technician_user.id = teamviewer_imported_cases.technician_user_id
      ${resolvedLocationJoin}
      ${whereSql}
      ORDER BY started_at DESC, id DESC
      ${limit ? 'LIMIT @limit OFFSET @offset' : ''}
    `
    )
    .all(params);
}

function findById(id) {
  return db
    .prepare(
      `
      SELECT
        teamviewer_imported_cases.*,
        technician_user.name AS technician_user_name,
        technician_user.email AS technician_user_email,
        technician_user.role AS technician_user_role
      FROM teamviewer_imported_cases
      LEFT JOIN users technician_user ON technician_user.id = teamviewer_imported_cases.technician_user_id
      WHERE teamviewer_imported_cases.id = ?
    `
    )
    .get(id);
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
        technician_user_id,
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
        @technician_user_id,
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
        technician_user_id,
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
        @technician_user_id,
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

function findDistinctGroups() {
  return db
    .prepare(
      `
      SELECT
        teamviewer_group_name,
        coalesce(explicit_location.id, matched_location.id, teamviewer_imported_cases.location_id) AS location_id,
        coalesce(explicit_location.name, matched_location.name, teamviewer_group_name) AS location_name
      FROM teamviewer_imported_cases
      LEFT JOIN locations explicit_location ON explicit_location.id = teamviewer_imported_cases.location_id
      LEFT JOIN locations matched_location
        ON teamviewer_imported_cases.location_id IS NULL
        AND lower(trim(coalesce(matched_location.name, ''))) = lower(trim(coalesce(teamviewer_imported_cases.teamviewer_group_name, '')))
      WHERE trim(coalesce(teamviewer_group_name, '')) <> ''
      GROUP BY lower(trim(teamviewer_group_name))
      ORDER BY lower(trim(teamviewer_group_name)) ASC
    `
    )
    .all();
}

module.exports = {
  findAll,
  findById,
  create,
  findDistinctGroups,
  remove,
  insertMany
};
