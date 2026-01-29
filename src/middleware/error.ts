import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
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

export const notFound = (req: Request, res: Response) => {
  return sendError(res, 404, `Route ${req.originalUrl} not found`);
};