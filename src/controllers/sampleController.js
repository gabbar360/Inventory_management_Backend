const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { SampleService } = require('../services/sampleService');

class SampleController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder, source } = parseQueryParams(req.query);
      const result = await SampleService.getAll(page, limit, search, sortBy, sortOrder, source);
      return sendResponse(res, 200, true, result.samples, 'Samples retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const sample = await SampleService.getById(id);
      return sendResponse(res, 200, true, sample, 'Sample retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async createFromWebsite(req, res) {
    try {
      const sample = await SampleService.createFromWebsite(req.body);
      return sendResponse(res, 201, true, sample, 'Sample request submitted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async create(req, res) {
    try {
      const sample = await SampleService.create(req.body);
      return sendResponse(res, 201, true, sample, 'Sample created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const sample = await SampleService.update(id, req.body);
      return sendResponse(res, 200, true, sample, 'Sample updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await SampleService.delete(id);
      return sendResponse(res, 200, true, result, 'Sample deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}

module.exports = { SampleController };
