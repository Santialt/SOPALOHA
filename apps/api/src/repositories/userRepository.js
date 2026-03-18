const db = require('../db/connection');

function mapFilters(filters = {}) {
  const where = [];
  const params = {};

  if (filters.active !== undefined && filters.active !== null) {
    where.push('active = @active');
    params.active = filters.active ? 1 : 0;
  }

  if (filters.role) {
    where.push('role = @role');
    params.role = filters.role;
  }

  if (filters.search) {
    where.push("(lower(name) LIKE lower(@search) OR lower(email) LIKE lower(@search))");
    params.search = `%${filters.search}%`;
  }

  return {
    params,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : ''
  };
}

function findAll(filters = {}) {
  const { whereSql, params } = mapFilters(filters);
  return db
    .prepare(
      `
      SELECT id, name, email, role, active, created_at, updated_at
      FROM users
      ${whereSql}
      ORDER BY lower(name) ASC, id ASC
    `
    )
    .all(params);
}

function findAssignable(filters = {}) {
  const where = ['active = 1'];
  const params = {};

  if (filters.role) {
    where.push('role = @role');
    params.role = filters.role;
  }

  return db
    .prepare(
      `
      SELECT id, name, email, role
      FROM users
      WHERE ${where.join(' AND ')}
      ORDER BY lower(name) ASC, id ASC
    `
    )
    .all(params);
}

function findActiveTechnicians() {
  return db
    .prepare(
      `
      SELECT id, name, email, role
      FROM users
      WHERE active = 1
        AND role = 'tech'
      ORDER BY lower(name) ASC, id ASC
    `
    )
    .all();
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
}

function findByName(name) {
  return db.prepare('SELECT * FROM users WHERE lower(trim(name)) = lower(trim(?))').get(name);
}

function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1").get().total;
}

function create(payload) {
  const result = db
    .prepare(
      `
      INSERT INTO users (name, email, password_hash, role, active)
      VALUES (@name, @email, @password_hash, @role, @active)
    `
    )
    .run({
      name: payload.name,
      email: payload.email,
      password_hash: payload.password_hash,
      role: payload.role,
      active: payload.active ? 1 : 0
    });

  return findById(result.lastInsertRowid);
}

function update(id, payload) {
  db.prepare(
    `
    UPDATE users
    SET
      name = @name,
      email = @email,
      password_hash = @password_hash,
      role = @role,
      active = @active
    WHERE id = @id
  `
  ).run({
    id,
    name: payload.name,
    email: payload.email,
    password_hash: payload.password_hash,
    role: payload.role,
    active: payload.active ? 1 : 0
  });

  return findById(id);
}

function updateActive(id, active) {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  return findById(id);
}

module.exports = {
  countAdmins,
  create,
  findAll,
  findAssignable,
  findActiveTechnicians,
  findByEmail,
  findByName,
  findById,
  update,
  updateActive
};
