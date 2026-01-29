import { Request, Response } from 'express';
import { CustomerService } from '../services/customerService';
import { sendResponse, sendError, parseQueryParams } from '../utils/response';

export class CustomerController {
  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await CustomerService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.customers, 'Customers retrieved successfully', result.pagination);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customer = await CustomerService.getById(id);
      return sendResponse(res, 200, true, customer, 'Customer retrieved successfully');
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const customer = await CustomerService.create(req.body);
      return sendResponse(res, 201, true, customer, 'Customer created successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customer = await CustomerService.update(id, req.body);
      return sendResponse(res, 200, true, customer, 'Customer updated successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await CustomerService.delete(id);
      return sendResponse(res, 200, true, result, 'Customer deleted successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }
}