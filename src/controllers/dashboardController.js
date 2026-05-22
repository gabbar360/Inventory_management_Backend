const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { DashboardService } = require('../services/dashboardService');


class DashboardController {
  static async getKPIs(req, res) {
    try {
      const { period, dateFrom, dateTo, location, category, vendor, customer } = req.query;
      const result = await DashboardService.getKPIs(period, dateFrom, dateTo, location, category, vendor, customer);
      return sendResponse(res, 200, true, result, 'KPIs retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getRevenueChart(req, res) {
    try {
      const { period, dateFrom, dateTo, location, category, vendor, customer } = req.query;
      const result = await DashboardService.getRevenueChart(period, dateFrom, dateTo, location, category, vendor, customer);
      return sendResponse(res, 200, true, result, 'Revenue chart data retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getTopProducts(req, res) {
    try {
      const { limit, dateFrom, dateTo, location, category, vendor, customer } = req.query;
      const result = await DashboardService.getTopProducts(parseInt(limit) || 10, dateFrom, dateTo, location, category, vendor, customer);
      return sendResponse(res, 200, true, result, 'Top products retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getTopCustomers(req, res) {
    try {
      const { limit, dateFrom, dateTo, location, category, vendor, customer } = req.query;
      const result = await DashboardService.getTopCustomers(parseInt(limit) || 10, dateFrom, dateTo, location, category, vendor, customer);
      return sendResponse(res, 200, true, result, 'Top customers retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getInventoryAlerts(req, res) {
    try {
      const result = await DashboardService.getInventoryAlerts();
      return sendResponse(res, 200, true, result, 'Inventory alerts retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getPerformanceMetrics(req, res) {
    try {
      const { period, dateFrom, dateTo, location, category, vendor, customer } = req.query;
      const result = await DashboardService.getPerformanceMetrics(period, dateFrom, dateTo, location, category, vendor, customer);
      return sendResponse(res, 200, true, result, 'Performance metrics retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }
}
module.exports = { DashboardController };
