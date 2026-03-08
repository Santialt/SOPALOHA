const express = require('express');
const controller = require('../controllers/onCallTechnicianController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const technicianRules = [
  { field: 'name', required: true },
  { field: 'is_active', type: 'boolean' }
];

router.get('/', controller.getTechnicians);
router.get('/:id', controller.getTechnicianById);
router.post('/', validateBody(technicianRules), controller.createTechnician);
router.put('/:id', validateBody(technicianRules), controller.updateTechnician);

module.exports = router;
