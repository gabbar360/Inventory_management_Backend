const { sendResponse, sendError } = require('../utils/helpers');
const { PermissionService } = require('../services/permissionService');

class PermissionController {
  static async getAllPermissions(req, res) {
    try {
      const permissions = await PermissionService.getAllPermissions();
      return sendResponse(res, 200, true, { permissions }, 'Permissions fetched successfully');
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return sendError(res, 500, error.message);
    }
  }

  static async getPermissionsByRole(req, res) {
    try {
      const { id } = req.params;
      const permissions = await PermissionService.getPermissionsByRole(parseInt(id));
      return sendResponse(res, 200, true, { permissions }, 'Role permissions fetched successfully');
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return sendError(res, 500, error.message);
    }
  }

  static async updateRolePermissions(req, res) {
    try {
      const { id } = req.params;
      const { permissionIds } = req.body;

      if (!Array.isArray(permissionIds)) {
        return sendError(res, 400, 'permissionIds must be an array of numbers');
      }

      const updatedPermissions = await PermissionService.updateRolePermissions(parseInt(id), permissionIds);
      return sendResponse(res, 200, true, { permissions: updatedPermissions }, 'Role permissions updated successfully');
    } catch (error) {
      console.error('Error updating role permissions:', error);
      return sendError(res, 500, error.message);
    }
  }
}

module.exports = { PermissionController };
