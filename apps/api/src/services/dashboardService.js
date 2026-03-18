const dashboardRepository = require('../repositories/dashboardRepository');
const locationRepository = require('../repositories/locationRepository');

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
  const importedCaseTotals = dashboardRepository.getImportedCaseTotals();
  const taskTotals = dashboardRepository.getTaskStatusTotals();
  const lastMonthStart = getMonthLookbackStart(30);
  const today = formatDateOnly(new Date());
  const topLocations = dashboardRepository.findTopIncidentLocationsByMonthStart(lastMonthStart, 5);
  const categoryBreakdown = dashboardRepository.findIncidentCategoryBreakdownByMonthStart(lastMonthStart);
  const mostFrequentCategory = categoryBreakdown[0] || null;
  const urgentTasksPreview = dashboardRepository.findOpenTasksWithDueDatePreview(today, 5);
  const totalCases = incidentTotals.total + importedCaseTotals.total;

  return {
    locations: locationRepository.countAll(),
    incidents: totalCases,
    tasks: taskTotals.total,
    taskMetrics: {
      totalTasks: taskTotals.total,
      openTasks: taskTotals.open,
      closedTasks: taskTotals.closed,
      urgentTasksPreview: urgentTasksPreview.length
        ? urgentTasksPreview
        : dashboardRepository.findOpenTasksWithoutDueDatePreview(5),
      urgentTasksPreviewMode: urgentTasksPreview.length ? 'due_date' : 'undated'
    },
    incidentMetrics: {
      totalCases,
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
