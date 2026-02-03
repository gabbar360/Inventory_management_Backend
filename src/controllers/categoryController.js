const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { CategoryService } = require('../services/categoryService');

class CategoryController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await CategoryService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.categories, 'Categories retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const category = await CategoryService.getById(id);
      return sendResponse(res, 200, true, category, 'Category retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const category = await CategoryService.create(req.body);
      return sendResponse(res, 201, true, category, 'Category created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const category = await CategoryService.update(id, req.body);
      return sendResponse(res, 200, true, category, 'Category updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await CategoryService.delete(id);
      return sendResponse(res, 200, true, result, 'Category deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { CategoryController };