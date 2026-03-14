const express = require('express');
const controller = require('../controllers/locationController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const locationRules = [
  { field: 'name', required: true },
  { field: 'usa_nbo', type: 'boolean' },
  { field: 'tiene_kitchen', type: 'boolean' },
  { field: 'usa_insight_pulse', type: 'boolean' },
  { field: 'cantidad_licencias_aloha', type: 'integer' },
  { field: 'fecha_apertura', pattern: /^\d{4}-\d{2}-\d{2}$/, patternDescription: 'YYYY-MM-DD' },
  { field: 'fecha_cierre', pattern: /^\d{4}-\d{2}-\d{2}$/, patternDescription: 'YYYY-MM-DD' },
  { field: 'status', allowedValues: ['abierto', 'cerrado', 'active', 'inactive'] }
];

router.get('/', controller.getLocations);
router.get('/search', controller.searchLocations);
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
