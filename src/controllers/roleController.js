const { sendResponse, sendError } = require("../utils/helpers");
const { RoleService } = require('../services/roleService');

class RoleController {
  static async getAllRoles(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const result = await RoleService.getAllRoles(parseInt(page), parseInt(limit), search);
      return sendResponse(res, 200, true, result, 'Roles fetched successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async getRoleById(req, res) {
    try {
      const { id } = req.params;
      const role = await RoleService.getRoleById(parseInt(id));
      return sendResponse(res, 200, true, { role }, 'Role fetched successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async createRole(req, res) {
    try {
      const { name, description, isSuperAdmin, isActive } = req.body;
      
      if (!name) {
        return sendError(res, 400, 'Role name is required');
      }

      const role = await RoleService.createRole({ name, description, isSuperAdmin, isActive });
      return sendResponse(res, 201, true, { role }, 'Role created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { name, description, isSuperAdmin, isActive } = req.body;
      
      const role = await RoleService.updateRole(parseInt(id), { name, description, isSuperAdmin, isActive });
      return sendResponse(res, 200, true, { role }, 'Role updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async deleteRole(req, res) {
    try {
      const { id } = req.params;
      await RoleService.deleteRole(parseInt(id));
      return sendResponse(res, 200, true, null, 'Role deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { RoleController };
