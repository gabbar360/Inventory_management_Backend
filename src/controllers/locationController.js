const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { LocationService } = require('../services/locationService');


class LocationController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await LocationService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.locations, 'Locations retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const location = await LocationService.getById(id);
      return sendResponse(res, 200, true, location, 'Location retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const location = await LocationService.create(req.body);
      return sendResponse(res, 201, true, location, 'Location created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const location = await LocationService.update(id, req.body);
      return sendResponse(res, 200, true, location, 'Location updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await LocationService.delete(id);
      return sendResponse(res, 200, true, result, 'Location deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
}
module.exports = { LocationController };
