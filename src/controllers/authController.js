const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { AuthService } = require('../services/authService');

const setCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
      
      return sendResponse(res, 201, true, { 
        user: result.user,
        accessToken: result.accessToken 
      }, 'User registered successfully');
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
      
      return sendResponse(res, 200, true, { 
        user: result.user,
        accessToken: result.accessToken 
      }, 'Login successful');
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
      
      return sendResponse(res, 200, true, { 
        user: result.user,
        accessToken: result.accessToken 
      }, 'Token refreshed successfully');
    } catch (error) {
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieOpts = { path: '/', secure: isProduction, sameSite: isProduction ? 'lax' : 'strict' };
      res.clearCookie('accessToken', cookieOpts);
      res.clearCookie('refreshToken', cookieOpts);
      return sendError(res, 401, error.message);
    }
  }

  static async logout(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
      
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieOpts = { path: '/', secure: isProduction, sameSite: isProduction ? 'lax' : 'strict' };
      res.clearCookie('accessToken', cookieOpts);
      res.clearCookie('refreshToken', cookieOpts);
      return sendResponse(res, 200, true, null, 'Logout successful');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async logoutAllDevices(req, res) {
    try {
      await AuthService.logoutAllDevices(req.user.id);
      
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieOpts = { path: '/', secure: isProduction, sameSite: isProduction ? 'lax' : 'strict' };
      res.clearCookie('accessToken', cookieOpts);
      res.clearCookie('refreshToken', cookieOpts);
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
      return sendResponse(res, 200, true, { 
        ...result,
        accessToken 
      }, 'Token is valid');
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
