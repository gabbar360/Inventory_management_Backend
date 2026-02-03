const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { CustomerService } = require('../services/customerService');


class CustomerController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await CustomerService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.customers, 'Customers retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const customer = await CustomerService.getById(id);
      return sendResponse(res, 200, true, customer, 'Customer retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const customer = await CustomerService.create(req.body);
      return sendResponse(res, 201, true, customer, 'Customer created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const customer = await CustomerService.update(id, req.body);
      return sendResponse(res, 200, true, customer, 'Customer updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await CustomerService.delete(id);
      return sendResponse(res, 200, true, result, 'Customer deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}
module.exports = { CustomerController };
