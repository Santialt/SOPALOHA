const service = require('../services/dashboardService');

function getSummary(req, res, next) {
  try {
    res.json(service.getSummary());
  } catch (error) {
    next(error);
  }
}

module.exports = { getSummary };
