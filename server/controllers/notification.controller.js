/**
 * server/controllers/notification.controller.js
 * Controller endpoints for authenticated notifications and preferences.
 */
'use strict';

const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

/**
 * GET /api/notifications
 * Paginated list of notifications for the authenticated user.
 */
const getNotifications = asyncHandler(async (req, res) => {
  const { category, priority, isRead, page = 1, limit = 20 } = req.query;

  const result = await notificationService.getUserNotifications(req.user.userId, {
    category,
    priority,
    isRead,
    page,
    limit,
  });

  return res.status(200).json({
    success: true,
    data: result.notifications,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
    unreadCount: result.unreadCount,
    message: 'Notifications retrieved successfully',
  });
});

/**
 * GET /api/notifications/unread-count
 * Returns the unread notification count for badge rendering.
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await notificationService.getUnreadCount(req.user.userId);
  return res.status(200).json({
    success: true,
    data: { unreadCount },
    message: 'Unread count retrieved',
  });
});

/**
 * GET /api/notifications/stream
 * Real-time Server-Sent Events (SSE) stream for instant notification push.
 * Authenticates strictly via Authorization header (Bearer token) or HttpOnly cookie.
 * URL query parameter token is prohibited to prevent credential leakage.
 */
const getNotificationStream = (req, res) => {
  // Prohibit long-lived JWTs in URL query parameters
  if (req.query?.token) {
    return res.status(400).json({
      success: false,
      error: 'Passing authentication tokens in URL query parameters is prohibited for security. Use Authorization header or HttpOnly cookie.',
    });
  }

  // Validate Origin header if present (anti-CSRF for cookie-based SSE)
  const origin = req.headers.origin;
  if (origin) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const allowedOrigins = [
      clientUrl,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5001',
      'http://127.0.0.1:5001',
    ];
    if (!allowedOrigins.includes(origin)) {
      return res.status(403).json({ success: false, error: 'Origin not allowed for notification stream' });
    }
  }

  // Derive token from Authorization header or HttpOnly cookie
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.campus_token) {
    token = req.cookies.campus_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Bearer token or valid session cookie missing.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
  }

  if (!decoded || !decoded.userId) {
    return res.status(401).json({ success: false, error: 'Malformed authentication token payload' });
  }

  // Set SSE streaming headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  notificationService.registerStream(decoded.userId, res, req, decoded.exp);
};

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
const markAsRead = asyncHandler(async (req, res) => {
  const notif = await notificationService.markAsRead(req.user.userId, req.params.id);
  if (!notif) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  return res.status(200).json({
    success: true,
    data: notif,
    message: 'Notification marked as read',
  });
});

/**
 * PATCH /api/notifications/read-all
 * Marks all eligible notifications as read for the authenticated user.
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const { category } = req.body || {};
  const result = await notificationService.markAllAsRead(req.user.userId, { category });

  return res.status(200).json({
    success: true,
    data: result,
    message: 'All notifications marked as read',
  });
});

/**
 * PATCH /api/notifications/:id/unread
 * Marks a single notification as unread.
 */
const markAsUnread = asyncHandler(async (req, res) => {
  const notif = await notificationService.markAsUnread(req.user.userId, req.params.id);
  if (!notif) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  return res.status(200).json({
    success: true,
    data: notif,
    message: 'Notification marked as unread',
  });
});

/**
 * DELETE /api/notifications/:id
 * Deletes a notification strictly owned by the authenticated user.
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const deleted = await notificationService.deleteNotification(req.user.userId, req.params.id);
  if (!deleted) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  return res.status(200).json({
    success: true,
    message: 'Notification deleted successfully',
  });
});

/**
 * GET /api/notifications/preferences
 * Returns the notification preferences of the authenticated user.
 */
const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await notificationService.getUserPreferences(req.user.userId);
  return res.status(200).json({
    success: true,
    data: preferences,
    message: 'Notification preferences retrieved',
  });
});

/**
 * PATCH /api/notifications/preferences
 * Updates user notification preference category subscriptions.
 */
const updatePreferences = asyncHandler(async (req, res) => {
  const updated = await notificationService.updateUserPreferences(req.user.userId, req.body);
  return res.status(200).json({
    success: true,
    data: updated,
    message: 'Notification preferences updated successfully',
  });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  getNotificationStream,
  markAsRead,
  markAllAsRead,
  markAsUnread,
  deleteNotification,
  getPreferences,
  updatePreferences,
};

