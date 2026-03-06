const express = require('express');
const controller = require('../controllers/deviceController');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', controller.getDevices);
router.post('/', requireFields(['location_id', 'name', 'type']), controller.createDevice);
router.get('/:id', controller.getDeviceById);
router.put('/:id', requireFields(['location_id', 'name', 'type']), controller.updateDevice);
router.delete('/:id', controller.deleteDevice);

module.exports = router;
