const express = require('express');
const { RoleController } = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all roles (paginated)
router.get('/roles', RoleController.getAllRoles);

// Get role by ID
router.get('/roles/:id', RoleController.getRoleById);

// Create new role
router.post('/roles', RoleController.createRole);

// Update role
router.put('/roles/:id', RoleController.updateRole);

// Delete role
router.delete('/roles/:id', RoleController.deleteRole);

module.exports = router;
