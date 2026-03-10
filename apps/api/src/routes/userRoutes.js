const express = require('express');
const controller = require('../controllers/userController');
const { requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const userRules = [
  { field: 'name', required: true },
  { field: 'email', required: true },
  { field: 'role', required: true, allowedValues: ['admin', 'tech'] },
  { field: 'active', type: 'boolean' }
];

const userUpdateRules = [
  { field: 'name' },
  { field: 'email' },
  { field: 'password' },
  { field: 'role', allowedValues: ['admin', 'tech'] },
  { field: 'active', type: 'boolean' }
];

router.get('/assignable', controller.listAssignableUsers);

router.use(requireRole('admin'));
router.get('/', controller.listUsers);
router.get('/:id', controller.getUserById);
router.post('/', validateBody([...userRules, { field: 'password', required: true }]), controller.createUser);
router.put('/:id', validateBody(userUpdateRules), controller.updateUser);
router.patch('/:id/active', validateBody([{ field: 'active', required: true, type: 'boolean' }]), controller.updateUserActive);

module.exports = router;
