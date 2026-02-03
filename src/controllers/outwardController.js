const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { OutwardService } = require('../services/outwardService');


class OutwardController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await OutwardService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.invoices, 'Outward invoices retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const invoice = await OutwardService.getById(id);
      return sendResponse(res, 200, true, invoice, 'Outward invoice retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const invoice = await OutwardService.create(req.body);
      return sendResponse(res, 201, true, invoice, 'Outward invoice created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const invoice = await OutwardService.update(id, req.body);
      return sendResponse(res, 200, true, invoice, 'Outward invoice updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await OutwardService.delete(id);
      return sendResponse(res, 200, true, result, 'Outward invoice deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async getProfitLoss(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const result = await OutwardService.getProfitLoss(
        startDate,
        endDate
      );
      return sendResponse(res, 200, true, result, 'Profit & Loss report retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }
}
module.exports = { OutwardController };
