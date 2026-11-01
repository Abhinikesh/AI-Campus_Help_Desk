/**
 * server/routes/notification.routes.js
 * Endpoints for notifications, unread counts, preferences, and real-time SSE stream.
 */
'use strict';

const express = require('express');
const router = express.Router();

const {
  getNotifications,
  getUnreadCount,
  getNotificationStream,
  markAsRead,
  markAllAsRead,
  markAsUnread,
  deleteNotification,
  getPreferences,
  updatePreferences,
} = require('../controllers/notification.controller');

const authMiddleware = require('../middleware/auth.middleware');

// Public SSE connection endpoint (authenticates internally via query or header token)
router.get('/stream', getNotificationStream);

// Protected routes (require standard authMiddleware)
router.use(authMiddleware);

router.get('/',                    getNotifications);
router.get('/unread-count',        getUnreadCount);
router.patch('/read-all',          markAllAsRead);
router.get('/preferences',         getPreferences);
router.patch('/preferences',       updatePreferences);
router.patch('/:id/read',          markAsRead);
router.patch('/:id/unread',        markAsUnread);
router.delete('/:id',              deleteNotification);

module.exports = router;

