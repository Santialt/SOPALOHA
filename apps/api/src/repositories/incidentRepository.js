const db = require('../db/connection');

function buildListQuery(filters = {}) {
  const where = [];
  const params = {};

  if (filters.location_id) {
    where.push('location_id = @location_id');
    params.location_id = filters.location_id;
  }

  if (filters.device_id) {
    where.push('device_id = @device_id');
    params.device_id = filters.device_id;
  }

  if (filters.status) {
    where.push('status = @status');
    params.status = filters.status;
  }

  if (filters.from_date) {
    where.push('incident_date >= @from_date');
    params.from_date = filters.from_date;
  }

  if (filters.to_date) {
    where.push('incident_date <= @to_date');
    params.to_date = filters.to_date;
  }

  if (filters.search) {
    where.push("(lower(coalesce(title, '')) LIKE lower(@search) OR lower(coalesce(description, '')) LIKE lower(@search) OR lower(coalesce(solution, '')) LIKE lower(@search))");
    params.search = `%${filters.search}%`;
  }

  const limit = Number.isInteger(filters.limit) ? filters.limit : null;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = limit ? 'LIMIT @limit OFFSET @offset' : '';

  if (limit) {
    params.limit = limit;
    params.offset = offset;
  }

  return { whereSql, limitSql, params };
}

function findAll(filters = {}) {
  const { whereSql, limitSql, params } = buildListQuery(filters);
  return db
    .prepare(
      `
      SELECT *
      FROM incidents
      ${whereSql}
      ORDER BY incident_date DESC, id DESC
      ${limitSql}
    `
    )
    .all(params);
}

function countAll(filters = {}) {
  const { whereSql, params } = buildListQuery(filters);
  return db.prepare(`SELECT COUNT(*) AS total FROM incidents ${whereSql}`).get(params).total;
}

function findById(id) {
  return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO incidents (
      location_id, device_id, incident_date, title, description, solution,
      category, time_spent_minutes, status, notes
    ) VALUES (
      @location_id, @device_id, @incident_date, @title, @description, @solution,
      @category, @time_spent_minutes, @status, @notes
    )
  `);

  const result = stmt.run({
    location_id: payload.location_id,
    device_id: payload.device_id || null,
    incident_date: payload.incident_date,
    title: payload.title,
    description: payload.description,
    solution: payload.solution || null,
    category: payload.category || 'other',
    time_spent_minutes: payload.time_spent_minutes || 0,
    status: payload.status || 'open',
    notes: payload.notes || null
  });

  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  const stmt = db.prepare(`
    UPDATE incidents
    SET
      location_id = @location_id,
      device_id = @device_id,
      incident_date = @incident_date,
      title = @title,
      description = @description,
      solution = @solution,
      category = @category,
      time_spent_minutes = @time_spent_minutes,
      status = @status,
      notes = @notes
    WHERE id = @id
  `);

  stmt.run({
    id,
    location_id: payload.location_id,
    device_id: payload.device_id || null,
    incident_date: payload.incident_date,
    title: payload.title,
    description: payload.description,
    solution: payload.solution || null,
    category: payload.category || 'other',
    time_spent_minutes: payload.time_spent_minutes || 0,
    status: payload.status || 'open',
    notes: payload.notes || null
  });

  return findById(id);
}

function remove(id) {
  const result = db.prepare('DELETE FROM incidents WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, countAll, findById, create, update, remove };
