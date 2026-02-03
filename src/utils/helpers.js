const sendResponse = (res, statusCode, success, data, message, pagination) => {
  return res.status(statusCode).json({ success, data, message, pagination });
};

const sendError = (res, statusCode, error) => {
  return res.status(statusCode).json({ success: false, error });
};

const parseQueryParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 10, 100);
  const search = query.search || '';
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  return { page, limit, search, sortBy, sortOrder };
};

const calculatePagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return { page, limit, total, totalPages, offset };
};

const generateCode = (prefix, lastCode) => {
  if (!lastCode) {
    return `${prefix}001`;
  }
  const number = parseInt(lastCode.replace(prefix, ''));
  const nextNumber = number + 1;
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
};

module.exports = { sendResponse, sendError, parseQueryParams, calculatePagination, generateCode };