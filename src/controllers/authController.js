const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { AuthService } = require('../services/authService');

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 1 * 60 * 1000, // 1 minute
    path: '/'
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/'
  });
};

const getDeviceInfo = (req) => {
  return req.headers['user-agent'] || 'Unknown';
};

const getIpAddress = (req) => {
  return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

class AuthController {
  static async register(req, res) {
    try {
      const { email, password, name } = req.body;
      const deviceInfo = getDeviceInfo(req);
      const ipAddress = getIpAddress(req);
      
      const result = await AuthService.register(email, password, name, deviceInfo, ipAddress);
      setCookies(res, result.accessToken, result.refreshToken);
      
      return sendResponse(res, 201, true, { user: result.user }, 'User registered successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const deviceInfo = getDeviceInfo(req);
      const ipAddress = getIpAddress(req);
      
      const result = await AuthService.login(email, password, deviceInfo, ipAddress);
      setCookies(res, result.accessToken, result.refreshToken);
      
      return sendResponse(res, 200, true, { user: result.user }, 'Login successful');
    } catch (error) {
      return sendError(res, 401, error.message);
    }
  }

  static async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (!refreshToken) {
        return sendError(res, 401, 'Refresh token not found');
      }

      const result = await AuthService.refreshAccessToken(refreshToken);
      setCookies(res, result.accessToken, result.refreshToken);
      
      return sendResponse(res, 200, true, { user: result.user }, 'Token refreshed successfully');
    } catch (error) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return sendError(res, 401, error.message);
    }
  }

  static async logout(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
      
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return sendResponse(res, 200, true, null, 'Logout successful');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async logoutAllDevices(req, res) {
    try {
      await AuthService.logoutAllDevices(req.user.id);
      
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return sendResponse(res, 200, true, null, 'Logged out from all devices');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async verifyToken(req, res) {
    try {
      const accessToken = req.cookies.accessToken;
      
      if (!accessToken) {
        return sendError(res, 401, 'Access token not found');
      }

      const result = await AuthService.verifyToken(accessToken);
      return sendResponse(res, 200, true, result, 'Token is valid');
    } catch (error) {
      return sendError(res, 401, error.message);
    }
  }

  static async getCurrentUser(req, res) {
    try {
      return sendResponse(res, 200, true, { user: req.user }, 'User fetched successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async updateProfile(req, res) {
    try {
      const { name, email } = req.body;
      const result = await AuthService.updateProfile(req.user.id, { name, email });
      return sendResponse(res, 200, true, { user: result }, 'Profile updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);
      return sendResponse(res, 200, true, null, result.message);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      const result = await AuthService.resetPassword(token, newPassword);
      return sendResponse(res, 200, true, null, result.message);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { AuthController };