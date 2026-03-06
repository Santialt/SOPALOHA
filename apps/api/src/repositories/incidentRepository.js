const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM incidents ORDER BY incident_date DESC, id DESC').all();
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

module.exports = { findAll, findById, create, update, remove };
