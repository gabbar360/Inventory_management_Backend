const { sendResponse, sendError } = require('../utils/helpers');
const { MenuService } = require('../services/menuService');

class MenuController {
  static async getSidebarMenu(req, res) {
    try {
      const roleId = req.user.roleId;
      if (!roleId) {
        return sendError(res, 403, 'Access denied: User does not have a role assigned');
      }

      const menuTree = await MenuService.getSidebarMenuForUser(roleId);
      return sendResponse(res, 200, true, { menu: menuTree }, 'Sidebar menu fetched successfully');
    } catch (error) {
      console.error('Error fetching sidebar menu:', error);
      return sendError(res, 500, error.message);
    }
  }

  static async getAllMenus(req, res) {
    try {
      const menus = await MenuService.getAllMenuItems();
      return sendResponse(res, 200, true, { menus }, 'Menus fetched successfully');
    } catch (error) {
      console.error('Error fetching all menus:', error);
      return sendError(res, 500, error.message);
    }
  }

  static async getMenuById(req, res) {
    try {
      const { id } = req.params;
      const menu = await MenuService.getMenuItemById(id);
      if (!menu) {
        return sendError(res, 404, 'Menu item not found');
      }
      return sendResponse(res, 200, true, { menu }, 'Menu item fetched successfully');
    } catch (error) {
      console.error('Error fetching menu item:', error);
      return sendError(res, 500, error.message);
    }
  }

  static async createMenu(req, res) {
    try {
      const menu = await MenuService.createMenuItem(req.body);
      return sendResponse(res, 201, true, { menu }, 'Menu item created successfully');
    } catch (error) {
      console.error('Error creating menu item:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async updateMenu(req, res) {
    try {
      const { id } = req.params;
      const menu = await MenuService.updateMenuItem(id, req.body);
      return sendResponse(res, 200, true, { menu }, 'Menu item updated successfully');
    } catch (error) {
      console.error('Error updating menu item:', error);
      return sendError(res, 400, error.message);
    }
  }

  static async deleteMenu(req, res) {
    try {
      const { id } = req.params;
      const { type } = req.query; // Accept type from query parameter
      await MenuService.deleteMenuItem(id, type);
      return sendResponse(res, 200, true, null, 'Menu item deleted successfully');
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { MenuController };
