const express = require('express');
const commentController = require('../controllers/commentController');
const controller = require('../controllers/incidentController');
const { requireRole } = require('../middleware/auth');
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
  { field: 'solution' },
  { field: 'category', allowedValues: ['network', 'sql', 'aloha', 'printer', 'fiscal', 'hardware', 'other'] },
  { field: 'status', allowedValues: ['open', 'closed'] },
  { field: 'time_spent_minutes', type: 'integer' },
  { field: 'notes' }
];

router.get('/', requireRole('tech'), controller.getIncidents);
router.post('/', requireRole('tech'), validateBody(incidentRules), controller.createIncident);
router.get('/:id/comments', requireRole('tech'), commentController.listIncidentComments);
router.post(
  '/:id/comments',
  requireRole('tech'),
  validateBody([{ field: 'comment', required: true }]),
  commentController.createIncidentComment
);
router.get('/:id', requireRole('tech'), controller.getIncidentById);
router.put('/:id', requireRole('tech'), validateBody(incidentRules), controller.updateIncident);
router.delete('/:id', requireRole('admin'), controller.deleteIncident);

module.exports = router;
