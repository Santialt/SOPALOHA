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
    .all({ sinceDate, limit });
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
  findTopIncidentLocationsByMonthStart,
  findIncidentCategoryBreakdownByMonthStart
};
