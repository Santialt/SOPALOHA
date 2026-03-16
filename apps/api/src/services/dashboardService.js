const dashboardRepository = require('../repositories/dashboardRepository');
const locationRepository = require('../repositories/locationRepository');
const incidentService = require('./incidentService');
const taskService = require('./taskService');

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthLookbackStart(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateOnly(date);
}

function getSummary() {
  const incidentTotals = dashboardRepository.getIncidentStatusTotals();
  const lastMonthStart = getMonthLookbackStart(30);
  const topLocations = dashboardRepository.findTopIncidentLocationsByMonthStart(lastMonthStart, 5);
  const categoryBreakdown = dashboardRepository.findIncidentCategoryBreakdownByMonthStart(lastMonthStart);
  const mostFrequentCategory = categoryBreakdown[0] || null;

  return {
    locations: locationRepository.countAll(),
    incidents: incidentService.countIncidents(),
    tasks: taskService.countTasks(),
    incidentMetrics: {
      totalCases: incidentTotals.total,
      resolvedCases: incidentTotals.closed,
      inProgressCases: incidentTotals.open,
      activeStatusKey: 'open',
      resolvedStatusKey: 'closed',
      lastMonthWindow: {
        days: 30,
        since: lastMonthStart
      },
      topLocations,
      categoryBreakdown,
      mostFrequentCategory: mostFrequentCategory
        ? {
            category: mostFrequentCategory.category,
            incidentCount: mostFrequentCategory.incident_count
          }
        : null
    }
  };
}

module.exports = { getSummary };
