import { Request, Response } from 'express';
import { LocationService } from '../services/locationService';
import { sendResponse, sendError, parseQueryParams } from '../utils/response';

export class LocationController {
  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await LocationService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.locations, 'Locations retrieved successfully', result.pagination);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const location = await LocationService.getById(id);
      return sendResponse(res, 200, true, location, 'Location retrieved successfully');
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const location = await LocationService.create(req.body);
      return sendResponse(res, 201, true, location, 'Location created successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const location = await LocationService.update(id, req.body);
      return sendResponse(res, 200, true, location, 'Location updated successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await LocationService.delete(id);
      return sendResponse(res, 200, true, result, 'Location deleted successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }
}