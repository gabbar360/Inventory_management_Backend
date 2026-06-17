const { sendResponse, sendError } = require("../utils/helpers");
const { UserService } = require('../services/userService');

class UserController {
  static async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const result = await UserService.getAllUsers(parseInt(page), parseInt(limit), search);
      return sendResponse(res, 200, true, result, 'Users fetched successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await UserService.getUserById(parseInt(id));
      return sendResponse(res, 200, true, { user }, 'User fetched successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async createUser(req, res) {
    try {
      const { email, password, name, roleId } = req.body;
      
      if (!email || !password || !name || !roleId) {
        return sendError(res, 400, 'Email, password, name, and roleId are required');
      }

      const user = await UserService.createUser({ email, password, name, roleId: parseInt(roleId) });
      return sendResponse(res, 201, true, { user }, 'User created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email, roleId, isActive } = req.body;
      
      const user = await UserService.updateUser(parseInt(id), { 
        name, 
        email, 
        roleId: roleId ? parseInt(roleId) : undefined, 
        isActive 
      });
      return sendResponse(res, 200, true, { user }, 'User updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      await UserService.deleteUser(parseInt(id));
      return sendResponse(res, 200, true, null, 'User deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async changePassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword) {
        return sendError(res, 400, 'New password is required');
      }

      await UserService.changePassword(parseInt(id), newPassword);
      return sendResponse(res, 200, true, null, 'Password changed successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { UserController };
