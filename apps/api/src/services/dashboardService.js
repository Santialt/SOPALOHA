const locationRepository = require('../repositories/locationRepository');
const incidentService = require('./incidentService');
const taskService = require('./taskService');

function getSummary() {
  return {
    locations: locationRepository.countAll(),
    incidents: incidentService.countIncidents(),
    tasks: taskService.countTasks()
  };
}

module.exports = { getSummary };
