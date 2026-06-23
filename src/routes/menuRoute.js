const express = require('express');
const { MenuController } = require('../controllers/menuController');
const { authenticateToken } = require('../middleware/auth');

const { authorizePermission } = require('../middleware/authorize');

const router = express.Router();

router.get('/menus/sidebar', authenticateToken, MenuController.getSidebarMenu);

router.get('/menus/:id', 
  authenticateToken, 
  authorizePermission('roles.read'), 
  MenuController.getMenuById
);

router.get('/menus', 
  authenticateToken, 
  authorizePermission('roles.read'), 
  MenuController.getAllMenus
);

router.post('/menus', 
  authenticateToken, 
  authorizePermission('roles.update'), 
  MenuController.createMenu
);

router.put('/menus/:id', 
  authenticateToken, 
  authorizePermission('roles.update'), 
  MenuController.updateMenu
);

router.delete('/menus/:id', 
  authenticateToken, 
  authorizePermission('roles.update'), 
  MenuController.deleteMenu
);

module.exports = router;
