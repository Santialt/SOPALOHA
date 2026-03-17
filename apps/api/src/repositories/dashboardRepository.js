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

function getImportedCaseTotals() {
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total
      FROM teamviewer_imported_cases
      WHERE linked_incident_id IS NULL
    `
    )
    .get();

  return {
    total: row?.total || 0
  };
}

function findTopIncidentLocationsByMonthStart(sinceDate, limit = 5) {
  return db
    .prepare(
      `
      SELECT
        aggregated.location_id AS location_id,
        aggregated.location_name AS location_name,
        SUM(aggregated.incident_count) AS incident_count
      FROM (
        SELECT
          incidents.location_id AS location_id,
          locations.name AS location_name,
          COUNT(*) AS incident_count
        FROM incidents
        JOIN locations ON locations.id = incidents.location_id
        WHERE incidents.incident_date >= @sinceDate
        GROUP BY incidents.location_id, locations.name

        UNION ALL

        SELECT
          coalesce(teamviewer_imported_cases.location_id, matched_location.id) AS location_id,
          coalesce(explicit_location.name, matched_location.name, teamviewer_imported_cases.teamviewer_group_name) AS location_name,
          COUNT(*) AS incident_count
        FROM teamviewer_imported_cases
        LEFT JOIN locations explicit_location
          ON explicit_location.id = teamviewer_imported_cases.location_id
        LEFT JOIN locations matched_location
          ON teamviewer_imported_cases.location_id IS NULL
          AND lower(trim(coalesce(matched_location.name, ''))) =
            lower(trim(coalesce(teamviewer_imported_cases.teamviewer_group_name, '')))
        WHERE teamviewer_imported_cases.linked_incident_id IS NULL
          AND teamviewer_imported_cases.started_at >= @sinceDateTime
        GROUP BY
          coalesce(teamviewer_imported_cases.location_id, matched_location.id),
          coalesce(explicit_location.name, matched_location.name, teamviewer_imported_cases.teamviewer_group_name)
      ) AS aggregated
      GROUP BY aggregated.location_id, aggregated.location_name
      ORDER BY incident_count DESC, aggregated.location_name ASC
      LIMIT @limit
    `
    )
    .all({
      sinceDate,
      sinceDateTime: `${sinceDate}T00:00:00.000Z`,
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
  getImportedCaseTotals,
  findTopIncidentLocationsByMonthStart,
  findIncidentCategoryBreakdownByMonthStart
};
