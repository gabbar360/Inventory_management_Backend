const express = require('express');
const { PermissionController } = require('../controllers/permissionController');
const { authenticateToken } = require('../middleware/auth');
const { authorizePermission } = require('./../middleware/authorize');

const router = express.Router();

router.get('/permissions', 
  authenticateToken, 
  authorizePermission('roles.read'), 
  PermissionController.getAllPermissions
);

router.get('/roles/:id/permissions', 
  authenticateToken, 
  authorizePermission('roles.read'), 
  PermissionController.getPermissionsByRole
);

router.post('/roles/:id/permissions', 
  authenticateToken, 
  authorizePermission('roles.update'), 
  PermissionController.updateRolePermissions
);

module.exports = router;
