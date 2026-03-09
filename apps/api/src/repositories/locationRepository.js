const db = require('../db/connection');

function findAll() {
  return db.prepare('SELECT * FROM locations ORDER BY name ASC').all();
}

function countAll() {
  return db.prepare('SELECT COUNT(*) AS total FROM locations').get().total;
}

function findById(id) {
  return db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
}

function create(payload) {
  const stmt = db.prepare(`
    INSERT INTO locations (
      name, company_name, razon_social, cuit, llave_aloha, version_aloha, version_modulo_fiscal,
      usa_nbo, network_notes, address, city, province, phone, main_contact, status, notes
    )
    VALUES (
      @name, @company_name, @razon_social, @cuit, @llave_aloha, @version_aloha, @version_modulo_fiscal,
      @usa_nbo, @network_notes, @address, @city, @province, @phone, @main_contact, @status, @notes
    )
  `);
  const result = stmt.run({
    name: payload.name,
    company_name: payload.company_name || null,
    razon_social: payload.razon_social || null,
    cuit: payload.cuit || null,
    llave_aloha: payload.llave_aloha || null,
    version_aloha: payload.version_aloha || null,
    version_modulo_fiscal: payload.version_modulo_fiscal || null,
    usa_nbo: payload.usa_nbo ? 1 : 0,
    network_notes: payload.network_notes || null,
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
      razon_social = @razon_social,
      cuit = @cuit,
      llave_aloha = @llave_aloha,
      version_aloha = @version_aloha,
      version_modulo_fiscal = @version_modulo_fiscal,
      usa_nbo = @usa_nbo,
      network_notes = @network_notes,
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
    razon_social: payload.razon_social || null,
    cuit: payload.cuit || null,
    llave_aloha: payload.llave_aloha || null,
    version_aloha: payload.version_aloha || null,
    version_modulo_fiscal: payload.version_modulo_fiscal || null,
    usa_nbo: payload.usa_nbo ? 1 : 0,
    network_notes: payload.network_notes || null,
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

function findIntegrationsByLocationId(locationId) {
  return db
    .prepare(
      'SELECT id, location_id, integration_name FROM location_integrations WHERE location_id = ? ORDER BY integration_name ASC'
    )
    .all(locationId);
}

function replaceIntegrations(locationId, integrationNames) {
  const cleaned = [...new Set(integrationNames.map((name) => String(name).trim()).filter(Boolean))];
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM location_integrations WHERE location_id = ?').run(locationId);

    const insertStmt = db.prepare(
      'INSERT INTO location_integrations (location_id, integration_name) VALUES (?, ?)'
    );
    for (const integrationName of cleaned) {
      insertStmt.run(locationId, integrationName);
    }
  });

  transaction();
  return findIntegrationsByLocationId(locationId);
}

module.exports = {
  findAll,
  countAll,
  findById,
  create,
  update,
  remove,
  findIntegrationsByLocationId,
  replaceIntegrations
};
