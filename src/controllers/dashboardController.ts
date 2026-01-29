import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboardService';
import { sendResponse, sendError } from '../utils/response';

export class DashboardController {
  static async getKPIs(req: Request, res: Response) {
    try {
      const { period } = req.query;
      const result = await DashboardService.getKPIs(period as 'week' | 'month' | 'year');
      return sendResponse(res, 200, true, result, 'KPIs retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getRevenueChart(req: Request, res: Response) {
    try {
      const { period } = req.query;
      const result = await DashboardService.getRevenueChart(period as 'week' | 'month' | 'year');
      return sendResponse(res, 200, true, result, 'Revenue chart data retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getTopProducts(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const result = await DashboardService.getTopProducts(parseInt(limit as string) || 10);
      return sendResponse(res, 200, true, result, 'Top products retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getTopCustomers(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const result = await DashboardService.getTopCustomers(parseInt(limit as string) || 10);
      return sendResponse(res, 200, true, result, 'Top customers retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getInventoryAlerts(req: Request, res: Response) {
    try {
      const result = await DashboardService.getInventoryAlerts();
      return sendResponse(res, 200, true, result, 'Inventory alerts retrieved successfully');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }
}