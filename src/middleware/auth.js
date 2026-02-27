const { PrismaClient } = require('@prisma/client');
const { verifyAccessToken } = require('../utils/tokenUtils');

const sendError = (res, statusCode, error) => {
  return res.status(statusCode).json({ success: false, error });
};

const prisma = new PrismaClient();

const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return sendError(res, 401, 'Please login to continue');
    }

    const decoded = verifyAccessToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return sendError(res, 401, 'Session expired. Please login again');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Session expired. Please login again');
    }
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 401, 'Invalid token. Please login again');
    }
    return sendError(res, 401, 'Authentication failed');
  }
};

const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      const errorMessage = error.errors?.[0]?.message || 'Validation failed';
      return sendError(res, 400, errorMessage);
    }
  };
};

module.exports = { authenticateToken, validateRequest };