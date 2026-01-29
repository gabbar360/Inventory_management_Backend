import { Request, Response } from 'express';
import { CategoryService } from '../services/categoryService';
import { sendResponse, sendError, parseQueryParams } from '../utils/response';

export class CategoryController {
  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await CategoryService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.categories, 'Categories retrieved successfully', result.pagination);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await CategoryService.getById(id);
      return sendResponse(res, 200, true, category, 'Category retrieved successfully');
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const category = await CategoryService.create(req.body);
      return sendResponse(res, 201, true, category, 'Category created successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await CategoryService.update(id, req.body);
      return sendResponse(res, 200, true, category, 'Category updated successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await CategoryService.delete(id);
      return sendResponse(res, 200, true, result, 'Category deleted successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }
}