const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { AuthService } = require('../services/authService');

class AuthController {
  static async register(req, res) {
    try {
      const { email, password, name } = req.body;
      const result = await AuthService.register(email, password, name);
      
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      
      return sendResponse(res, 201, true, { user: result.user }, 'User registered successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      
      return sendResponse(res, 200, true, { user: result.user }, 'Login successful');
    } catch (error) {
      return sendError(res, 401, error.message);
    }
  }

  static async logout(req, res) {
    try {
      res.clearCookie('token');
      return sendResponse(res, 200, true, null, 'Logout successful');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async getCurrentUser(req, res) {
    try {
      return sendResponse(res, 200, true, { user: req.user }, 'User fetched successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { AuthController };