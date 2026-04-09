const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { ProductService } = require('../services/productService');


class ProductController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await ProductService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.products, 'Products retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const product = await ProductService.getById(id);
      return sendResponse(res, 200, true, product, 'Product retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const product = await ProductService.create(req.body);
      return sendResponse(res, 201, true, product, 'Product created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const product = await ProductService.update(id, req.body);
      return sendResponse(res, 200, true, product, 'Product updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await ProductService.delete(id);
      return sendResponse(res, 200, true, result, 'Product deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}
module.exports = { ProductController };
