const sendError = (res, statusCode, error) => {
  return res.status(statusCode).json({ success: false, error });
};

const errorHandler = (
  error,
  req,
  res,
  next
) => {
  console.error('Error:', error);

  if (error.code === 'P2002') {
    return sendError(res, 400, 'Record already exists');
  }

  if (error.code === 'P2025') {
    return sendError(res, 404, 'Record not found');
  }

  if (error.code === 'P2003') {
    return sendError(res, 400, 'Foreign key constraint failed');
  }

  return sendError(res, 500, 'Internal server error');
};

const notFound = (req, res) => {
  return sendError(res, 404, `Route ${req.originalUrl} not found`);
};

module.exports = { errorHandler, notFound };