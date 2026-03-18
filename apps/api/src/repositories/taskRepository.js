const db = require('../db/connection');

function findAll(filters = {}) {
  const where = [];
  const params = {};

  if (filters.status) {
    where.push('status = @status');
    params.status = filters.status;
  }

  if (filters.priority) {
    where.push('priority = @priority');
    params.priority = filters.priority;
  }

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

  const sql = `
    SELECT
      tasks.*,
      creator.name AS created_by_name,
      updater.name AS updated_by_name,
      assigned_user.name AS assigned_user_name,
      coalesce(assigned_user.name, nullif(trim(tasks.assigned_to), '')) AS assignment_display_name
    FROM tasks
    LEFT JOIN users creator ON creator.id = tasks.created_by
    LEFT JOIN users updater ON updater.id = tasks.updated_by
    LEFT JOIN users assigned_user ON assigned_user.id = tasks.assigned_user_id
    ${whereSql}
    ORDER BY
      scheduled_for IS NULL,
      scheduled_for ASC,
      due_date IS NULL,
      due_date ASC,
      id DESC
    ${limitSql}
  `;

  return db.prepare(sql).all(params);
}

function countAll(filters = {}) {
  const where = [];
  const params = {};

  if (filters.status) {
    where.push('status = @status');
    params.status = filters.status;
  }

  if (filters.priority) {
    where.push('priority = @priority');
    params.priority = filters.priority;
  }

  if (filters.location_id) {
    where.push('location_id = @location_id');
    params.location_id = filters.location_id;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`SELECT COUNT(*) AS total FROM tasks ${whereSql}`).get(params).total;
}

function findById(id) {
  return db
    .prepare(
      `
      SELECT
        tasks.*,
        creator.name AS created_by_name,
        updater.name AS updated_by_name,
        assigned_user.name AS assigned_user_name,
        coalesce(assigned_user.name, nullif(trim(tasks.assigned_to), '')) AS assignment_display_name
      FROM tasks
      LEFT JOIN users creator ON creator.id = tasks.created_by
      LEFT JOIN users updater ON updater.id = tasks.updated_by
      LEFT JOIN users assigned_user ON assigned_user.id = tasks.assigned_user_id
      WHERE tasks.id = ?
    `
    )
    .get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO tasks (
      title, description, location_id, device_id, incident_id,
      status, priority, assigned_to, assigned_user_id, due_date, scheduled_for, task_type, created_by, updated_by
    ) VALUES (
      @title, @description, @location_id, @device_id, @incident_id,
      @status, @priority, @assigned_to, @assigned_user_id, @due_date, @scheduled_for, @task_type, @created_by, @updated_by
    )
  `);

  const result = stmt.run({
    title: payload.title,
    description: payload.description || null,
    location_id: payload.location_id ?? null,
    device_id: payload.device_id ?? null,
    incident_id: payload.incident_id ?? null,
    status: payload.status || 'pending',
    priority: payload.priority || 'medium',
    assigned_to: payload.assigned_to || null,
    assigned_user_id: payload.assigned_user_id ?? null,
    due_date: payload.due_date || null,
    scheduled_for: payload.scheduled_for || null,
    task_type: payload.task_type || 'general',
    created_by: payload.created_by ?? null,
    updated_by: payload.updated_by ?? payload.created_by ?? null
  });

  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  const stmt = db.prepare(`
    UPDATE tasks
    SET
      title = @title,
      description = @description,
      location_id = @location_id,
      device_id = @device_id,
      incident_id = @incident_id,
      status = @status,
      priority = @priority,
      assigned_to = @assigned_to,
      assigned_user_id = @assigned_user_id,
      due_date = @due_date,
      scheduled_for = @scheduled_for,
      task_type = @task_type,
      updated_by = @updated_by
    WHERE id = @id
  `);

  stmt.run({
    id,
    title: payload.title,
    description: payload.description || null,
    location_id: payload.location_id ?? null,
    device_id: payload.device_id ?? null,
    incident_id: payload.incident_id ?? null,
    status: payload.status || 'pending',
    priority: payload.priority || 'medium',
    assigned_to: payload.assigned_to || null,
    assigned_user_id: payload.assigned_user_id ?? null,
    due_date: payload.due_date || null,
    scheduled_for: payload.scheduled_for || null,
    task_type: payload.task_type || 'general',
    updated_by: payload.updated_by ?? null
  });

  return findById(id);
}

function remove(id) {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, countAll, findById, create, update, remove };
