const express = require('express');
const controller = require('../controllers/deviceController');
const { requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const deviceTypeValues = [
  'server',
  'pos_terminal',
  'fiscal_printer',
  'kitchen_printer',
  'pinpad',
  'router',
  'switch',
  'other'
];

const deviceRoleValues = [
  'server',
  'pos',
  'kitchen_display',
  'kitchen_printer',
  'fiscal_printer',
  'router',
  'switch',
  'other'
];

const deviceRules = [
  { field: 'location_id', required: true, type: 'integer' },
  { field: 'name', required: true },
  { field: 'type', allowedValues: deviceTypeValues },
  { field: 'device_role', allowedValues: deviceRoleValues },
  { field: 'ram_gb', type: 'number' }
];

router.get('/', controller.getDevices);
router.post('/', validateBody(deviceRules), controller.createDevice);
router.get('/:id', controller.getDeviceById);
router.put('/:id', validateBody(deviceRules), controller.updateDevice);
router.delete('/:id', requireRole('admin'), controller.deleteDevice);

module.exports = router;
