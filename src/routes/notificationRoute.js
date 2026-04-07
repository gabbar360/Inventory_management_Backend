const express = require('express');
const { NotificationController } = require('../controllers/notificationController');

const router = express.Router();

// Specific routes first (before parameterized routes)
router.get('/notifications/unread/count', NotificationController.getUnread);
router.put('/notifications/read/all', NotificationController.markAllAsRead);
router.delete('/notifications/delete/all', NotificationController.deleteAll);

// Parameterized routes after
router.get('/notifications', NotificationController.getAll);
router.put('/notifications/:id/read', NotificationController.markAsRead);
router.delete('/notifications/:id', NotificationController.delete);

module.exports = router;
