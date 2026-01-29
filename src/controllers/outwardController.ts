import { Request, Response } from 'express';
import { OutwardService } from '../services/outwardService';
import { sendResponse, sendError, parseQueryParams } from '../utils/response';

export class OutwardController {
  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await OutwardService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.invoices, 'Outward invoices retrieved successfully', result.pagination);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const invoice = await OutwardService.getById(id);
      return sendResponse(res, 200, true, invoice, 'Outward invoice retrieved successfully');
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const invoice = await OutwardService.create(req.body);
      return sendResponse(res, 201, true, invoice, 'Outward invoice created successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await OutwardService.delete(id);
      return sendResponse(res, 200, true, result, 'Outward invoice deleted successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async getProfitLoss(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const result = await OutwardService.getProfitLoss(
        startDate as string,
        endDate as string
      );
      return sendResponse(res, 200, true, result, 'Profit & Loss report retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }
}