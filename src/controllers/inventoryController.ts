import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import { sendResponse, sendError } from '../utils/response';

export class InventoryController {
  static async getStockSummary(req: Request, res: Response) {
    try {
      const { locationId } = req.query;
      const result = await InventoryService.getStockSummary(locationId as string);
      return sendResponse(res, 200, true, result, 'Stock summary retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getAvailableStock(req: Request, res: Response) {
    try {
      const { productId, locationId } = req.query;
      
      if (!productId) {
        return sendError(res, 400, 'Product ID is required');
      }

      const result = await InventoryService.getAvailableStock(
        productId as string,
        locationId as string
      );
      return sendResponse(res, 200, true, result, 'Available stock retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }
}