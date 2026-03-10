const db = require('../db/connection');

function findByEntity(entityType, entityId) {
  return db
    .prepare(
      `
      SELECT
        comments.*,
        users.name AS user_name,
        users.email AS user_email
      FROM comments
      LEFT JOIN users ON users.id = comments.user_id
      WHERE comments.entity_type = ? AND comments.entity_id = ?
      ORDER BY comments.created_at ASC, comments.id ASC
    `
    )
    .all(entityType, entityId);
}

function create(payload) {
  const result = db
    .prepare(
      `
      INSERT INTO comments (entity_type, entity_id, user_id, comment)
      VALUES (@entity_type, @entity_id, @user_id, @comment)
    `
    )
    .run(payload);

  return db
    .prepare(
      `
      SELECT comments.*, users.name AS user_name, users.email AS user_email
      FROM comments
      LEFT JOIN users ON users.id = comments.user_id
      WHERE comments.id = ?
    `
    )
    .get(result.lastInsertRowid);
}

module.exports = { create, findByEntity };
