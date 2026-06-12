const { BarcodeService, validateBarcodeFormat } = require('../services/barcodeService');
const { sendResponse, sendError } = require('../utils/helpers');

class BarcodeController {
  static async lookup(req, res) {
    try {
      const { barcode } = req.params;
      
      console.log(`[Barcode Lookup] Request - Barcode: ${barcode}`);
      
      if (!barcode || barcode.trim().length === 0) {
        console.log(`[Barcode Lookup] ❌ Error: Barcode is empty`);
        return sendError(res, 400, 'Barcode is required');
      }
      
      if (!validateBarcodeFormat(barcode)) {
        console.log(`[Barcode Lookup] ❌ Error: Invalid barcode format - ${barcode}`);
        return sendError(res, 400, 'Invalid barcode format');
      }

      const box = await BarcodeService.lookupBarcode(barcode);
      if (!box) {
        console.log(`[Barcode Lookup] ❌ Barcode not found in database - ${barcode}`);
        return sendError(res, 404, 'Barcode not found');
      }
      console.log(`[Barcode Lookup] ✅ Found - Box ID: ${box.id}, Status: ${box.status}`);
      return sendResponse(res, 200, true, box, 'Barcode looked up successfully');
    } catch (error) {
      console.log(`[Barcode Lookup] ❌ Exception: ${error.message}`);
      return sendError(res, 500, error.message);
    }
  }

  static async scan(req, res) {
    try {
      const { barcode, flow, locationId, customerId } = req.body;
      
      console.log(`[Barcode Scan] Request received`);
      console.log(`  - Barcode: ${barcode}`);
      console.log(`  - Flow: ${flow}`);
      console.log(`  - LocationId: ${locationId}`);
      console.log(`  - CustomerId: ${customerId}`);
      
      if (!barcode || barcode.trim().length === 0) {
        console.log(`[Barcode Scan] ❌ Error: Barcode is empty`);
        return sendError(res, 400, 'Barcode is required');
      }
      
      if (!validateBarcodeFormat(barcode)) {
        console.log(`[Barcode Scan] ❌ Error: Invalid barcode format - ${barcode}`);
        return sendError(res, 400, 'Invalid barcode format');
      }
      
      if (!flow || !['inward', 'outward'].includes(flow)) {
        console.log(`[Barcode Scan] ❌ Error: Invalid flow - ${flow}`);
        return sendError(res, 400, 'Flow is required and must be "inward" or "outward"');
      }

      console.log(`[Barcode Scan] Processing ${flow} scan for barcode: ${barcode}`);
      const result = await BarcodeService.scanBarcode(barcode, flow, locationId, customerId);
      console.log(`[Barcode Scan] ✅ ${flow} scan successful - ${result.message}`);
      return sendResponse(res, 200, true, result, result.message);
    } catch (error) {
      console.log(`[Barcode Scan] ❌ Exception: ${error.message}`);
      console.log(`[Barcode Scan] Stack: ${error.stack}`);
      return sendError(res, 400, error.message);
    }
  }

  static async getBarcodesForPrint(req, res) {
    try {
      const { source, id } = req.params;
      
      console.log(`[Get Barcodes for Print] Request - Source: ${source}, ID: ${id}`);
      
      if (!['po', 'inward'].includes(source)) {
        console.log(`[Get Barcodes for Print] ❌ Invalid source: ${source}`);
        return sendError(res, 400, 'Invalid source. Must be po or inward');
      }
      
      if (!id || isNaN(parseInt(id))) {
        console.log(`[Get Barcodes for Print] ❌ Invalid ID: ${id}`);
        return sendError(res, 400, 'Valid ID is required');
      }

      const boxes = await BarcodeService.getBarcodesForPrint(source, id);
      console.log(`[Get Barcodes for Print] ✅ Retrieved ${boxes.length} boxes`);
      return sendResponse(res, 200, true, boxes, 'Barcodes retrieved for print');
    } catch (error) {
      console.log(`[Get Barcodes for Print] ❌ Exception: ${error.message}`);
      return sendError(res, 500, error.message);
    }
  }
}

module.exports = { BarcodeController };
