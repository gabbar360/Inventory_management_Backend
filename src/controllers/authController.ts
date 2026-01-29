import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { sendResponse, sendError } from '../utils/response';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      const result = await AuthService.register(email, password, name);
      return sendResponse(res, 201, true, result, 'User registered successfully');
    } catch (error: any) {
      return sendError(res, 400, error.message);
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      return sendResponse(res, 200, true, result, 'Login successful');
    } catch (error: any) {
      return sendError(res, 401, error.message);
    }
  }
}