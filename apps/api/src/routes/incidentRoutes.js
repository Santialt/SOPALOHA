const express = require('express');
const controller = require('../controllers/incidentController');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', controller.getIncidents);
router.post(
  '/',
  requireFields(['location_id', 'incident_date', 'title', 'description']),
  controller.createIncident
);
router.get('/:id', controller.getIncidentById);
router.put(
  '/:id',
  requireFields(['location_id', 'incident_date', 'title', 'description']),
  controller.updateIncident
);
router.delete('/:id', controller.deleteIncident);

module.exports = router;
