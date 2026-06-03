const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { InventoryService } = require('../services/inventoryService');


class InventoryController {
  static async getStockSummary(req, res) {
    try {
      const { page, limit, locationId, search } = parseQueryParams(req.query);
      const result = await InventoryService.getStockSummary(page, limit, locationId, search);
      return res.status(200).json({
        success: true,
        data: result.data,
        lowStockItems: result.lowStockItems,
        globalStats: result.globalStats,
        pagination: result.pagination,
        message: 'Stock summary retrieved successfully'
      });
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getAvailableStock(req, res) {
    try {
      const { productId, locationId, includeIds } = req.query;
      
      if (!productId) {
        return sendError(res, 400, 'Product ID is required');
      }

      const includeIdsArray = includeIds ? (Array.isArray(includeIds) ? includeIds : [includeIds]) : [];

      const result = await InventoryService.getAvailableStock(
        productId,
        locationId,
        includeIdsArray
      );
      return sendResponse(res, 200, true, result, 'Available stock retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }
}
module.exports = { InventoryController };
