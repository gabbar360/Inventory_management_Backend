const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class NotificationService {
  static async getAll(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    });

    const total = await prisma.notification.count({
      where: { receiverId: userId },
    });

    return {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async getUnreadCount(userId) {
    const count = await prisma.notification.count({
      where: { receiverId: userId, isRead: false },
    });
    return count;
  }

  static async markAsRead(notificationId, userId) {
    const notification = await prisma.notification.update({
      where: { id: notificationId, receiverId: userId },
      data: { isRead: true, readAt: new Date() },
    });
    return notification;
  }

  static async markAllAsRead(userId) {
    await prisma.notification.updateMany({
      where: { receiverId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async delete(notificationId, userId) {
    await prisma.notification.delete({
      where: { id: notificationId, receiverId: userId },
    });
  }

  static async deleteAll(userId) {
    await prisma.notification.deleteMany({
      where: { receiverId: userId },
    });
  }

  static async create(data) {
    const notification = await prisma.notification.create({
      data,
    });

    return notification;
  }

  static async createForAllUsers(data) {
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    const notifications = [];
    for (const user of users) {
      const notification = await prisma.notification.create({
        data: {
          ...data,
          receiverId: user.id,
        },
      });
      notifications.push(notification);
    }

    return notifications;
  }

  static async createForRole(data, roleName) {
    const users = await prisma.user.findMany({
      where: {
        role: {
          name: roleName,
        },
      },
      select: { id: true },
    });

    const notifications = [];
    for (const user of users) {
      const notification = await prisma.notification.create({
        data: {
          ...data,
          receiverId: user.id,
        },
      });
      notifications.push(notification);
    }

    return notifications;
  }
}

module.exports = { NotificationService };
