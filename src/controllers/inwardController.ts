import { Request, Response } from 'express';
import { InwardService } from '../services/inwardService';
import { sendResponse, sendError, parseQueryParams } from '../utils/response';

export class InwardController {
  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await InwardService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.invoices, 'Inward invoices retrieved successfully', result.pagination);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const invoice = await InwardService.getById(id);
      return sendResponse(res, 200, true, invoice, 'Inward invoice retrieved successfully');
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const invoice = await InwardService.create(req.body);
      return sendResponse(res, 201, true, invoice, 'Inward invoice created successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const invoice = await InwardService.update(id, req.body);
      return sendResponse(res, 200, true, invoice, 'Inward invoice updated successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await InwardService.delete(id);
      return sendResponse(res, 200, true, result, 'Inward invoice deleted successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }
}