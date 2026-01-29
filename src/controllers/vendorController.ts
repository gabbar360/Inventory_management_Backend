import { Request, Response } from 'express';
import { VendorService } from '../services/vendorService';
import { sendResponse, sendError, parseQueryParams } from '../utils/response';

export class VendorController {
  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await VendorService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.vendors, 'Vendors retrieved successfully', result.pagination);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const vendor = await VendorService.getById(id);
      return sendResponse(res, 200, true, vendor, 'Vendor retrieved successfully');
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const vendor = await VendorService.create(req.body);
      return sendResponse(res, 201, true, vendor, 'Vendor created successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const vendor = await VendorService.update(id, req.body);
      return sendResponse(res, 200, true, vendor, 'Vendor updated successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await VendorService.delete(id);
      return sendResponse(res, 200, true, result, 'Vendor deleted successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }
}