const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM locations ORDER BY name ASC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO locations (name, company_name, address, city, province, phone, main_contact, status, notes)
    VALUES (@name, @company_name, @address, @city, @province, @phone, @main_contact, @status, @notes)
  `);
  const result = stmt.run({
    name: payload.name,
    company_name: payload.company_name || null,
    address: payload.address || null,
    city: payload.city || null,
    province: payload.province || null,
    phone: payload.phone || null,
    main_contact: payload.main_contact || null,
    status: payload.status || 'active',
    notes: payload.notes || null
  });
  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  const stmt = db.prepare(`
    UPDATE locations
    SET
      name = @name,
      company_name = @company_name,
      address = @address,
      city = @city,
      province = @province,
      phone = @phone,
      main_contact = @main_contact,
      status = @status,
      notes = @notes
    WHERE id = @id
  `);
  stmt.run({
    id,
    name: payload.name,
    company_name: payload.company_name || null,
    address: payload.address || null,
    city: payload.city || null,
    province: payload.province || null,
    phone: payload.phone || null,
    main_contact: payload.main_contact || null,
    status: payload.status || 'active',
    notes: payload.notes || null
  });
  return findById(id);
}

function remove(id) {
  const result = db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { findAll, findById, create, update, remove };
