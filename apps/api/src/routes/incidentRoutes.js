const express = require('express');
const commentController = require('../controllers/commentController');
const controller = require('../controllers/incidentController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const incidentRules = [
  { field: 'location_id', required: true, type: 'integer' },
  { field: 'device_id', type: 'integer' },
  {
    field: 'incident_date',
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/,
    patternDescription: 'YYYY-MM-DD o YYYY-MM-DDTHH:mm'
  },
  { field: 'title', required: true },
  { field: 'description', required: true },
  { field: 'category', allowedValues: ['network', 'sql', 'aloha', 'printer', 'fiscal', 'hardware', 'other'] },
  { field: 'status', allowedValues: ['open', 'closed'] },
  { field: 'time_spent_minutes', type: 'integer' }
];

router.get('/', controller.getIncidents);
router.post('/', validateBody(incidentRules), controller.createIncident);
router.get('/:id/comments', commentController.listIncidentComments);
router.post('/:id/comments', validateBody([{ field: 'comment', required: true }]), commentController.createIncidentComment);
router.get('/:id', controller.getIncidentById);
router.put('/:id', validateBody(incidentRules), controller.updateIncident);
router.delete('/:id', controller.deleteIncident);

module.exports = router;
