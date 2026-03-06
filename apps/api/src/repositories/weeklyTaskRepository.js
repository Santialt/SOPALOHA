const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM weekly_tasks ORDER BY due_date IS NULL, due_date ASC, id DESC').all();
}

function findById(id) {
  return findById(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO weekly_tasks (location_id, title, description, priority, status, due_date)
    VALUES (@location_id, @title, @description, @priority, @status, @due_date)
  `);
  const result = stmt.run({
    location_id: payload.location_id || null,
    title: payload.title,
    description: payload.description || null,
    priority: payload.priority || 'medium',
    status: payload.status || 'todo',
    due_date: payload.due_date || null
  });

  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  const stmt = db.prepare(`
    UPDATE weekly_tasks
    SET
      location_id = @location_id,
      title = @title,
      description = @description,
      priority = @priority,
      status = @status,
      due_date = @due_date
    WHERE id = @id
  `);

  stmt.run({
    id,
    location_id: payload.location_id || null,
    title: payload.title,
    description: payload.description || null,
    priority: payload.priority || 'medium',
    status: payload.status || 'todo',
    due_date: payload.due_date || null
  });

  return findById(id);
}

function remove(id) {
  const result = db.prepare('DELETE FROM weekly_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, findById, create, update, remove };
