import { Response } from 'express';
import { ApiResponse } from '../types';

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  success: boolean,
  data?: T,
  message?: string,
  pagination?: any
): Response => {
  const response: ApiResponse<T> = {
    success,
    data,
    message,
    pagination,
  };

  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  error: string
): Response => {
  const response: ApiResponse = {
    success: false,
    error,
  };

  return res.status(statusCode).json(response);
};

export const generateCode = (prefix: string, lastCode?: string): string => {
  if (!lastCode) {
    return `${prefix}001`;
  }

  const number = parseInt(lastCode.replace(prefix, ''));
  const nextNumber = number + 1;
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
};

export const calculatePagination = (page: number, limit: number, total: number) => {
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    total,
    totalPages,
    offset,
  };
};

export const parseQueryParams = (query: any) => {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 10, 100);
  const search = query.search || '';
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, search, sortBy, sortOrder };
};