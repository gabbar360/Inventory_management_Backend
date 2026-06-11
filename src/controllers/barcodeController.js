const { BarcodeService, validateBarcodeFormat } = require('../services/barcodeService');
const { sendResponse, sendError } = require('../utils/helpers');

class BarcodeController {
  static async lookup(req, res) {
    try {
      const { barcode } = req.params;
      
      if (!barcode || barcode.trim().length === 0) {
        return sendError(res, 400, 'Barcode is required');
      }
      
      if (!validateBarcodeFormat(barcode)) {
        return sendError(res, 400, 'Invalid barcode format');
      }

      const box = await BarcodeService.lookupBarcode(barcode);
      if (!box) {
        return sendError(res, 404, 'Barcode not found');
      }
      return sendResponse(res, 200, true, box, 'Barcode looked up successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async scan(req, res) {
    try {
      const { barcode, flow, locationId, customerId } = req.body;
      
      if (!barcode || barcode.trim().length === 0) {
        return sendError(res, 400, 'Barcode is required');
      }
      
      if (!validateBarcodeFormat(barcode)) {
        return sendError(res, 400, 'Invalid barcode format');
      }
      
      if (!flow || !['inward', 'outward'].includes(flow)) {
        return sendError(res, 400, 'Flow is required and must be "inward" or "outward"');
      }

      const result = await BarcodeService.scanBarcode(barcode, flow, locationId, customerId);
      return sendResponse(res, 200, true, result, result.message);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async getBarcodesForPrint(req, res) {
    try {
      const { source, id } = req.params;
      
      if (!['po', 'inward'].includes(source)) {
        return sendError(res, 400, 'Invalid source. Must be po or inward');
      }
      
      if (!id || isNaN(parseInt(id))) {
        return sendError(res, 400, 'Valid ID is required');
      }

      const boxes = await BarcodeService.getBarcodesForPrint(source, id);
      return sendResponse(res, 200, true, boxes, 'Barcodes retrieved for print');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }
}

module.exports = { BarcodeController };
