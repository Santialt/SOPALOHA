const express = require('express');
const controller = require('../controllers/locationController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const locationRules = [
  { field: 'name', required: true },
  { field: 'usa_nbo', type: 'boolean' },
  { field: 'status', allowedValues: ['active', 'inactive'] }
];

router.get('/', controller.getLocations);
router.post('/', validateBody(locationRules), controller.createLocation);
router.get('/:id', controller.getLocationById);
router.get('/:id/devices', controller.getLocationDevices);
router.get('/:id/incidents', controller.getLocationIncidents);
router.get('/:id/tasks', controller.getLocationTasks);
router.get('/:id/notes', controller.getLocationNotes);
router.put('/:id', validateBody(locationRules), controller.updateLocation);
router.get('/:id/integrations', controller.getLocationIntegrations);
router.put('/:id/integrations', controller.putLocationIntegrations);
router.delete('/:id', controller.deleteLocation);

module.exports = router;
