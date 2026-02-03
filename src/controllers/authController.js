const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { AuthService } = require('../services/authService');

class AuthController {
  static async register(req, res) {
    try {
      const { email, password, name } = req.body;
      const result = await AuthService.register(email, password, name);
      return sendResponse(res, 201, true, result, 'User registered successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      return sendResponse(res, 200, true, result, 'Login successful');
    } catch (error) {
      return sendError(res, 401, error.message);
    }
  }
}

module.exports = { AuthController };