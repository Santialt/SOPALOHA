const express = require('express');
const controller = require('../controllers/onCallTemplateController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const templateRules = [
  { field: 'title', required: true },
  { field: 'start_time', required: true, pattern: /^([01]\d|2[0-3]):([0-5]\d)$/, patternDescription: 'HH:MM' },
  { field: 'end_time', required: true, pattern: /^([01]\d|2[0-3]):([0-5]\d)$/, patternDescription: 'HH:MM' },
  { field: 'crosses_to_next_day', type: 'boolean' }
];

router.get('/', controller.getTemplates);
router.get('/:id', controller.getTemplateById);
router.post('/', validateBody(templateRules), controller.createTemplate);
router.put('/:id', validateBody(templateRules), controller.updateTemplate);

module.exports = router;
