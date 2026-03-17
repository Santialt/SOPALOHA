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
  { field: 'ip_address' },
  { field: 'teamviewer_id' },
  { field: 'windows_version' },
  { field: 'ram_gb', type: 'number' },
  { field: 'cpu' },
  { field: 'disk_type' },
  { field: 'username' },
  { field: 'operating_system' },
  { field: 'sql_version' },
  { field: 'sql_instance' },
  { field: 'aloha_path' },
  { field: 'brand' },
  { field: 'model' },
  { field: 'notes' }
];

router.get('/', requireRole('tech'), controller.getDevices);
router.post('/', requireRole('admin'), validateBody(deviceRules), controller.createDevice);
router.get('/:id', requireRole('tech'), controller.getDeviceById);
router.put('/:id', requireRole('admin'), validateBody(deviceRules), controller.updateDevice);
router.delete('/:id', requireRole('admin'), controller.deleteDevice);

module.exports = router;
