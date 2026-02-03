const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { VendorService } = require('../services/vendorService');


class VendorController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await VendorService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.vendors, 'Vendors retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const vendor = await VendorService.getById(id);
      return sendResponse(res, 200, true, vendor, 'Vendor retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const vendor = await VendorService.create(req.body);
      return sendResponse(res, 201, true, vendor, 'Vendor created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const vendor = await VendorService.update(id, req.body);
      return sendResponse(res, 200, true, vendor, 'Vendor updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await VendorService.delete(id);
      return sendResponse(res, 200, true, result, 'Vendor deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}
module.exports = { VendorController };
