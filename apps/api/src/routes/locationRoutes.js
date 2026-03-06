const express = require('express');
const controller = require('../controllers/locationController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const locationRules = [
  { field: 'name', required: true },
  { field: 'status', allowedValues: ['active', 'inactive'] }
];

router.get('/', controller.getLocations);
router.post('/', validateBody(locationRules), controller.createLocation);
router.get('/:id', controller.getLocationById);
router.put('/:id', validateBody(locationRules), controller.updateLocation);
router.delete('/:id', controller.deleteLocation);

module.exports = router;
