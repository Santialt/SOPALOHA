const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM devices ORDER BY id DESC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO devices (
      location_id, name, type, ip_address, teamviewer_id, username, password,
      operating_system, sql_version, sql_instance, aloha_path, brand, model, notes
    ) VALUES (
      @location_id, @name, @type, @ip_address, @teamviewer_id, @username, @password,
      @operating_system, @sql_version, @sql_instance, @aloha_path, @brand, @model, @notes
    )
  `);
  const result = stmt.run({
    location_id: payload.location_id,
    name: payload.name,
    type: payload.type,
    ip_address: payload.ip_address || null,
    teamviewer_id: payload.teamviewer_id || null,
    username: payload.username || null,
    password: payload.password || null,
    operating_system: payload.operating_system || null,
    sql_version: payload.sql_version || null,
    sql_instance: payload.sql_instance || null,
    aloha_path: payload.aloha_path || null,
    brand: payload.brand || null,
    model: payload.model || null,
    notes: payload.notes || null
  });
  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  const stmt = db.prepare(`
    UPDATE devices
    SET
      location_id = @location_id,
      name = @name,
      type = @type,
      ip_address = @ip_address,
      teamviewer_id = @teamviewer_id,
      username = @username,
      password = @password,
      operating_system = @operating_system,
      sql_version = @sql_version,
      sql_instance = @sql_instance,
      aloha_path = @aloha_path,
      brand = @brand,
      model = @model,
      notes = @notes
    WHERE id = @id
  `);

  stmt.run({
    id,
    location_id: payload.location_id,
    name: payload.name,
    type: payload.type,
    ip_address: payload.ip_address || null,
    teamviewer_id: payload.teamviewer_id || null,
    username: payload.username || null,
    password: payload.password || null,
    operating_system: payload.operating_system || null,
    sql_version: payload.sql_version || null,
    sql_instance: payload.sql_instance || null,
    aloha_path: payload.aloha_path || null,
    brand: payload.brand || null,
    model: payload.model || null,
    notes: payload.notes || null
  });

  return findById(id);
}

function remove(id) {
  const result = db.prepare('DELETE FROM devices WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, findById, create, update, remove };
