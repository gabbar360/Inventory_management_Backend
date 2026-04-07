const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { NotificationService } = require('../services/notificationService');

const prisma = new PrismaClient();
let io = null;
const connectedUsers = new Map();

const initializeSocket = (server) => {
  const jwtSecret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET_KEY or JWT_SECRET is required');
  }

  io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      console.log('[SOCKET] Auth middleware - incoming connection:', {
        socketId: socket.id,
        hasAuthToken: !!socket.handshake.auth.token,
        hasAuthHeader: !!socket.handshake.headers.authorization,
      });

      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        console.log('[SOCKET] Auth failed - no token provided');
        return next(new Error('No token provided'));
      }

      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId || decoded.id;

      console.log('[SOCKET] Token verified:', { userId });

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.log('[SOCKET] Auth failed - user not found:', { userId });
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.user = user;

      console.log('[SOCKET] Auth successful:', { userId: user.id, email: user.email });
      next();
    } catch (error) {
      console.warn('[SOCKET] Auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log('[SOCKET] ✅ NEW CONNECTION ESTABLISHED:', {
      userId: socket.userId,
      socketId: socket.id,
      totalConnected: connectedUsers.size + 1,
    });

    connectedUsers.set(socket.userId, socket.id);
    console.log('[SOCKET] User added to map:', {
      userId: socket.userId,
      socketId: socket.id,
      mapSize: connectedUsers.size,
      allUsers: Array.from(connectedUsers.entries()),
    });

    socket.join(`user_${socket.userId}`);

    // Send unread notifications count on connect
    sendUnreadNotificationsCount(socket.userId);

    socket.on('disconnect', () => {
      console.log('[SOCKET] ❌ User disconnected:', {
        userId: socket.userId,
        socketId: socket.id,
      });
      connectedUsers.delete(socket.userId);
      console.log('[SOCKET] User removed from map:', {
        mapSize: connectedUsers.size,
        allUsers: Array.from(connectedUsers.entries()),
      });
    });

    socket.on('mark_notification_read', async (notificationId) => {
      await markNotificationAsRead(notificationId, socket.userId);
    });

    socket.on('mark_all_notifications_read', async () => {
      await markAllNotificationsAsRead(socket.userId);
    });
  });

  console.log('[SOCKET] Server initialized');
};

// Send notification to specific user
const sendNotificationToUser = async (userId, notification) => {
  console.log('[SOCKET] sendNotificationToUser called:', {
    userId,
    notificationId: notification.id,
    connectedUsersMap: Array.from(connectedUsers.entries()),
  });

  const socketId = connectedUsers.get(userId);
  console.log('[SOCKET] Socket lookup result:', { userId, socketId, found: !!socketId });

  if (socketId && io) {
    console.log('[SOCKET] ✅ Emitting notification:', {
      socketId,
      notificationId: notification.id,
      title: notification.title,
    });
    io.to(socketId).emit('new_notification', notification);
  } else {
    console.log('[SOCKET] ❌ Cannot send notification:', {
      userId,
      socketId,
      ioExists: !!io,
      reason: !socketId ? 'User not connected' : 'IO not available',
    });
  }
};

// Send unread count to user
const sendUnreadNotificationsCount = async (userId) => {
  try {
    const count = await prisma.notification.count({
      where: { receiverId: userId, isRead: false },
    });

    const socketId = connectedUsers.get(userId);
    if (socketId && io) {
      io.to(socketId).emit('unread_notifications_count', count);
      console.log('[SOCKET] Unread count sent:', { userId, count });
    }
  } catch (error) {
    console.error('[SOCKET] Error sending unread count:', error.message);
  }
};

// Mark single notification as read
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    await prisma.notification.update({
      where: { id: notificationId, receiverId: userId },
      data: { isRead: true, readAt: new Date() },
    });

    sendUnreadNotificationsCount(userId);
  } catch (error) {
    console.error('[SOCKET] Error marking as read:', error.message);
  }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (userId) => {
  try {
    await prisma.notification.updateMany({
      where: { receiverId: userId },
      data: { isRead: true, readAt: new Date() },
    });

    sendUnreadNotificationsCount(userId);
  } catch (error) {
    console.error('[SOCKET] Error marking all as read:', error.message);
  }
};

// Create notification and send to user
const createNotification = async (data) => {
  console.log('[SOCKET] createNotification called:', {
    type: data.type,
    receiverId: data.receiverId,
  });

  const notification = await prisma.notification.create({
    data,
  });

  console.log('[SOCKET] Notification created in DB:', {
    id: notification.id,
    receiverId: notification.receiverId,
  });

  await sendNotificationToUser(notification.receiverId, notification);

  return notification;
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  createNotification,
  sendUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getIO,
  connectedUsers,
};
