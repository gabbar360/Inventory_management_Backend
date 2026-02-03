const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { InwardService } = require('../services/inwardService');

class InwardController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await InwardService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.invoices, 'Inward invoices retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InwardService.getById(id);
      return sendResponse(res, 200, true, invoice, 'Inward invoice retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const invoice = await InwardService.create(req.body);
      return sendResponse(res, 201, true, invoice, 'Inward invoice created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InwardService.update(id, req.body);
      return sendResponse(res, 200, true, invoice, 'Inward invoice updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await InwardService.delete(id);
      return sendResponse(res, 200, true, result, 'Inward invoice deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}
module.exports = { InwardController };
