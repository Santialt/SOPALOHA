const db = require('../db/connection');

function getIncidentStatusTotals() {
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open
      FROM incidents
    `
    )
    .get();

  return {
    total: row?.total || 0,
    closed: row?.closed || 0,
    open: row?.open || 0
  };
}

function getTaskStatusTotals() {
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('pending', 'in_progress', 'blocked') THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status IN ('done', 'cancelled') THEN 1 ELSE 0 END) AS closed
      FROM tasks
    `
    )
    .get();

  return {
    total: row?.total || 0,
    open: row?.open || 0,
    closed: row?.closed || 0
  };
}

function findOpenTasksWithDueDatePreview(today, limit = 5) {
  return db
    .prepare(
      `
      SELECT
        tasks.id,
        tasks.title,
        tasks.status,
        tasks.priority,
        tasks.due_date,
        tasks.location_id,
        locations.name AS location_name
      FROM tasks
      LEFT JOIN locations ON locations.id = tasks.location_id
      WHERE tasks.status IN ('pending', 'in_progress', 'blocked')
        AND tasks.due_date IS NOT NULL
        AND trim(tasks.due_date) <> ''
      ORDER BY
        CASE WHEN date(tasks.due_date) < date(@today) THEN 0 ELSE 1 END ASC,
        date(tasks.due_date) ASC,
        tasks.id DESC
      LIMIT @limit
    `
    )
    .all({ today, limit });
}

function findOpenTasksWithoutDueDatePreview(limit = 5) {
  return db
    .prepare(
      `
      SELECT
        tasks.id,
        tasks.title,
        tasks.status,
        tasks.priority,
        tasks.due_date,
        tasks.location_id,
        locations.name AS location_name
      FROM tasks
      LEFT JOIN locations ON locations.id = tasks.location_id
      WHERE tasks.status IN ('pending', 'in_progress', 'blocked')
        AND (tasks.due_date IS NULL OR trim(tasks.due_date) = '')
      ORDER BY tasks.id DESC
      LIMIT @limit
    `
    )
    .all({ limit });
}

function findTopIncidentLocationsByMonthStart(sinceDate, limit = 5) {
  return db
    .prepare(
      `
      SELECT
        incidents.location_id AS location_id,
        locations.name AS location_name,
        COUNT(*) AS incident_count
      FROM incidents
      JOIN locations ON locations.id = incidents.location_id
      WHERE incidents.incident_date >= @sinceDate
      GROUP BY incidents.location_id, locations.name
      ORDER BY incident_count DESC, locations.name ASC
      LIMIT @limit
    `
    )
    .all({
      sinceDate,
      limit
    });
}

function findIncidentCategoryBreakdownByMonthStart(sinceDate) {
  return db
    .prepare(
      `
      SELECT
        category,
        COUNT(*) AS incident_count
      FROM incidents
      WHERE incident_date >= @sinceDate
      GROUP BY category
      ORDER BY incident_count DESC, category ASC
    `
    )
    .all({ sinceDate });
}

module.exports = {
  getIncidentStatusTotals,
  getTaskStatusTotals,
  findOpenTasksWithDueDatePreview,
  findOpenTasksWithoutDueDatePreview,
  findTopIncidentLocationsByMonthStart,
  findIncidentCategoryBreakdownByMonthStart
};
