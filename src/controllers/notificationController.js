const { sendResponse, sendError } = require('../utils/helpers');
const { NotificationService } = require('../services/notificationService');

class NotificationController {
  static async getAll(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const result = await NotificationService.getAll(userId, page, limit);
      return sendResponse(res, 200, true, result.notifications, 'Notifications retrieved', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getUnread(req, res) {
    try {
      const userId = req.user.id;
      const count = await NotificationService.getUnreadCount(userId);
      return sendResponse(res, 200, true, { count }, 'Unread count retrieved');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await NotificationService.markAsRead(parseInt(id), userId);
      return sendResponse(res, 200, true, notification, 'Notification marked as read');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      await NotificationService.markAllAsRead(userId);
      return sendResponse(res, 200, true, null, 'All notifications marked as read');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await NotificationService.delete(parseInt(id), userId);
      return sendResponse(res, 200, true, null, 'Notification deleted');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async deleteAll(req, res) {
    try {
      const userId = req.user.id;
      await NotificationService.deleteAll(userId);
      return sendResponse(res, 200, true, null, 'All notifications deleted');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }
}

module.exports = { NotificationController };
