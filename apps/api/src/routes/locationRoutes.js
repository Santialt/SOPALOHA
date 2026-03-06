const express = require('express');
const controller = require('../controllers/locationController');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', controller.getLocations);
router.post('/', requireFields(['name']), controller.createLocation);
router.get('/:id', controller.getLocationById);
router.put('/:id', requireFields(['name']), controller.updateLocation);
router.delete('/:id', controller.deleteLocation);

module.exports = router;
