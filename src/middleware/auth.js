const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const sendError = (res, statusCode, error) => {
  return res.status(statusCode).json({ success: false, error });
};

const prisma = new PrismaClient();

const authenticateToken = async (
  req,
  res,
  next
) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return sendError(res, 401, 'Access token required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return sendError(res, 401, 'Invalid token');
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 401, 'Invalid token');
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