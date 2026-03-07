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

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT *
    FROM tasks
    ${whereSql}
    ORDER BY
      scheduled_for IS NULL,
      scheduled_for ASC,
      due_date IS NULL,
      due_date ASC,
      id DESC
  `;

  return db.prepare(sql).all(params);
}

function findById(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO tasks (
      title, description, location_id, device_id, incident_id,
      status, priority, assigned_to, due_date, scheduled_for, task_type
    ) VALUES (
      @title, @description, @location_id, @device_id, @incident_id,
      @status, @priority, @assigned_to, @due_date, @scheduled_for, @task_type
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
    due_date: payload.due_date || null,
    scheduled_for: payload.scheduled_for || null,
    task_type: payload.task_type || 'general'
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
      due_date = @due_date,
      scheduled_for = @scheduled_for,
      task_type = @task_type
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
    due_date: payload.due_date || null,
    scheduled_for: payload.scheduled_for || null,
    task_type: payload.task_type || 'general'
  });

  return findById(id);
}

module.exports = { findAll, findById, create, update };
