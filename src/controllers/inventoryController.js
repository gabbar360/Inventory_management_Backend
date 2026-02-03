const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { InventoryService } = require('../services/inventoryService');


class InventoryController {
  static async getStockSummary(req, res) {
    try {
      const { locationId } = req.query;
      const result = await InventoryService.getStockSummary(locationId);
      return sendResponse(res, 200, true, result, 'Stock summary retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getAvailableStock(req, res) {
    try {
      const { productId, locationId } = req.query;
      
      if (!productId) {
        return sendError(res, 400, 'Product ID is required');
      }

      const result = await InventoryService.getAvailableStock(
        productId,
        locationId
      );
      return sendResponse(res, 200, true, result, 'Available stock retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }
}
module.exports = { InventoryController };
