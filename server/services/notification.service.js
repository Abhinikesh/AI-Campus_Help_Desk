/**
 * server/services/notification.service.js
 * Centralized Notification Engine & Real-time Server-Sent Events (SSE) Delivery.
 */
'use strict';

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const ApiError = require('../utils/ApiError');

class NotificationService {
  constructor() {
    /**
     * Map of active real-time SSE HTTP response streams.
     * Key: String(userId) -> Value: Set of active HTTP Response objects.
     */
    this.activeStreams = new Map();
  }

  // ── 1. REAL-TIME SSE CONNECTION MANAGEMENT ─────────────────────────────────

  /**
   * Registers an open HTTP response stream for real-time Server-Sent Events (SSE).
   * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID.
   * @param {import('express').Response} res - Express HTTP Response object.
   * @param {import('express').Request} req - Express HTTP Request object.
   * @param {number|null} [expiresAtEpochSeconds] - JWT expiration timestamp (seconds).
   */
  registerStream(userId, res, req, expiresAtEpochSeconds = null) {
    const userKey = String(userId);
    if (!this.activeStreams.has(userKey)) {
      this.activeStreams.set(userKey, new Set());
    }

    const userSet = this.activeStreams.get(userKey);
    userSet.add(res);

    // Initial connection handshake event
    try {
      res.write(`event: connected\ndata: ${JSON.stringify({ userId: userKey, connectedAt: new Date().toISOString() })}\n\n`);
    } catch (_) {}

    // Periodic heartbeat (ping) to prevent proxy socket timeout and detect disconnects
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (err) {
        cleanup();
      }
    }, 25000);

    // Handle token expiry during active stream
    let expiryTimer = null;
    if (expiresAtEpochSeconds && typeof expiresAtEpochSeconds === 'number') {
      const msUntilExpiry = expiresAtEpochSeconds * 1000 - Date.now();
      if (msUntilExpiry > 0) {
        expiryTimer = setTimeout(() => {
          try {
            res.write(`event: auth_expired\ndata: ${JSON.stringify({ message: 'Token expired. Reconnect required.' })}\n\n`);
            res.end();
          } catch (_) {}
          cleanup();
        }, msUntilExpiry);
      }
    }

    const cleanup = () => {
      clearInterval(heartbeatInterval);
      if (expiryTimer) clearTimeout(expiryTimer);
      userSet.delete(res);
      if (userSet.size === 0) {
        this.activeStreams.delete(userKey);
      }
    };

    req.on('close', cleanup);
    if (typeof res.on === 'function') {
      res.on('error', cleanup);
      res.on('close', cleanup);
    }
  }

  /**
   * Pushes a real-time event to an authenticated user's active SSE streams.
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {string} eventName
   * @param {object} payload
   */
  emitRealtimeEvent(userId, eventName, payload) {
    const userKey = String(userId);
    const streams = this.activeStreams.get(userKey);
    if (!streams || streams.size === 0) return false;

    const eventData = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const res of streams) {
      try {
        res.write(eventData);
      } catch (err) {
        streams.delete(res);
      }
    }

    if (streams.size === 0) {
      this.activeStreams.delete(userKey);
    }

    return true;
  }

  // ── 2. PREFERENCE MANAGEMENT ───────────────────────────────────────────────

  /**
   * Retrieves or creates default notification preferences for a user.
   * @param {string|mongoose.Types.ObjectId} userId
   */
  async getUserPreferences(userId) {
    let pref = await NotificationPreference.findOne({ user: userId });
    if (!pref) {
      pref = await NotificationPreference.create({ user: userId });
    }
    return pref;
  }

  /**
   * Updates category toggles for a user while enforcing mandatory system notifications.
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {object} updateData
   */
  async updateUserPreferences(userId, updateData = {}) {
    const current = await this.getUserPreferences(userId);

    if (updateData.categories && typeof updateData.categories === 'object') {
      const allowedCategories = [
        'academic',
        'attendance',
        'examination',
        'assignment',
        'timetable',
        'announcement',
        'fee',
        'library',
        'hostel',
        'administrative',
      ];

      // Validate that all provided category keys are recognized
      for (const key of Object.keys(updateData.categories)) {
        if (key === 'system') {
          // Mandatory: always kept true
          continue;
        }
        if (!allowedCategories.includes(key)) {
          throw new ApiError(400, `Invalid preference category key: '${key}'`);
        }
      }

      for (const cat of allowedCategories) {
        if (typeof updateData.categories[cat] === 'boolean') {
          current.categories[cat] = updateData.categories[cat];
        }
      }

      // Mandatory system notifications can never be disabled
      current.categories.system = true;
    }

    if (updateData.channels && typeof updateData.channels === 'object') {
      if (typeof updateData.channels.inApp === 'boolean') {
        current.channels.inApp = updateData.channels.inApp;
      }
      if (typeof updateData.channels.email === 'boolean') {
        current.channels.email = updateData.channels.email;
      }
    }

    await current.save();
    return current;
  }

  // ── 3. NOTIFICATION CREATION & DEDUPLICATION ─────────────────────────────────

  /**
   * Authoritatively creates and persists a single notification with preference checking & real-time delivery.
   */
  async createNotification({
    recipient,
    title,
    message,
    category = 'system',
    priority = 'normal',
    relatedEntityType = null,
    relatedEntityId = null,
    targetRoute = null,
    actor = null,
    actorName = 'CampusSphere',
    actorRole = 'system',
    eventId = null,
    expiresAt = null,
  }) {
    if (!recipient) {
      throw new Error('Notification recipient is required');
    }

    const cleanEventId = typeof eventId === 'string' && eventId.trim() ? eventId.trim() : null;

    // 1. Idempotency Check: Prevent duplicate notifications for the same event
    if (cleanEventId) {
      const existing = await Notification.findOne({ recipient, eventId: cleanEventId });
      if (existing) {
        return { isDuplicate: true, notification: existing };
      }
    }

    // 2. Preference Check: Respect user opt-out unless urgent priority or system category
    if (category !== 'system' && priority !== 'urgent') {
      const pref = await this.getUserPreferences(recipient);
      if (pref.categories && pref.categories[category] === false) {
        return { skipped: true, reason: 'preference_disabled' };
      }
    }

    // Sanitize target route: must start with / and not open redirect // or protocol
    const safeTargetRoute =
      typeof targetRoute === 'string' && targetRoute.startsWith('/') && !targetRoute.startsWith('//')
        ? targetRoute
        : null;

    // 3. Persist in MongoDB with concurrency-safe duplicate handling
    let notification;
    try {
      notification = await Notification.create({
        recipient,
        title: title.trim(),
        message: message.trim(),
        category,
        priority,
        relatedEntityType,
        relatedEntityId,
        targetRoute: safeTargetRoute,
        actor,
        actorName,
        actorRole,
        eventId: cleanEventId,
        expiresAt,
      });
    } catch (err) {
      if (err.code === 11000 && cleanEventId) {
        // Concurrency safeguard: Another worker created it simultaneously
        const existing = await Notification.findOne({ recipient, eventId: cleanEventId });
        return { isDuplicate: true, notification: existing };
      }
      throw err;
    }

    // 4. Push Real-time SSE Event
    this.emitRealtimeEvent(recipient, 'notification', notification);
    this.getUnreadCount(recipient)
      .then((count) => {
        this.emitRealtimeEvent(recipient, 'unread_count', { unreadCount: count });
      })
      .catch(() => {});

    return { isDuplicate: false, notification };
  }

  /**
   * Bulk creates notifications across multiple recipients efficiently with preference filtering.
   */
  async createBulkNotifications({
    recipients = [],
    title,
    message,
    category = 'system',
    priority = 'normal',
    relatedEntityType = null,
    relatedEntityId = null,
    targetRoute = null,
    actor = null,
    actorName = 'CampusSphere',
    actorRole = 'system',
    eventId = null,
    eventIdPrefix = null,
    expiresAt = null,
  }) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return { count: 0, recipientCount: 0 };
    }

    // Deduplicate recipient IDs
    const uniqueRecipients = [...new Set(recipients.map((id) => String(id)))];

    // Batch query preferences
    let optedOutRecipients = new Set();
    if (category !== 'system' && priority !== 'urgent') {
      const prefs = await NotificationPreference.find({
        user: { $in: uniqueRecipients },
      }).lean();

      for (const p of prefs) {
        if (p.categories && p.categories[category] === false) {
          optedOutRecipients.add(String(p.user));
        }
      }
    }

    // Filter recipients
    const eligibleRecipients = uniqueRecipients.filter(
      (id) => !optedOutRecipients.has(id)
    );

    if (eligibleRecipients.length === 0) {
      return { count: 0, recipientCount: 0 };
    }

    const safeTargetRoute =
      typeof targetRoute === 'string' && targetRoute.startsWith('/') && !targetRoute.startsWith('//')
        ? targetRoute
        : null;

    const resolvedEventId =
      typeof eventId === 'string' && eventId.trim()
        ? eventId.trim()
        : (typeof eventIdPrefix === 'string' && eventIdPrefix.trim() ? eventIdPrefix.trim() : null);

    // Build documents
    const docs = eligibleRecipients.map((recipientId) => ({
      recipient: recipientId,
      title: title.trim(),
      message: message.trim(),
      category,
      priority,
      relatedEntityType,
      relatedEntityId,
      targetRoute: safeTargetRoute,
      actor,
      actorName,
      actorRole,
      eventId: resolvedEventId,
      expiresAt,
    }));

    // Batch insert with duplicate key handling
    let insertedDocs = [];
    try {
      insertedDocs = await Notification.insertMany(docs, { ordered: false });
    } catch (bulkErr) {
      // In case of duplicate keys (E11000) or partial duplicates with eventId
      if (bulkErr.code === 11000 || (bulkErr.writeErrors && bulkErr.writeErrors.some((e) => e.code === 11000))) {
        insertedDocs = bulkErr.insertedDocs || [];
      } else {
        throw bulkErr; // Rethrow unexpected DB errors
      }
    }

    // Push real-time event to all active streams
    for (const notif of insertedDocs) {
      this.emitRealtimeEvent(notif.recipient, 'notification', notif);
      this.getUnreadCount(notif.recipient)
        .then((count) => {
          this.emitRealtimeEvent(notif.recipient, 'unread_count', { unreadCount: count });
        })
        .catch(() => {});
    }

    return { count: insertedDocs.length, recipientCount: eligibleRecipients.length };
  }

  // ── 4. NOTIFICATION RETRIEVAL & ACTIONS ──────────────────────────────────────

  /**
   * Retrieves unread notification count for a user.
   */
  async getUnreadCount(userId) {
    return Notification.countDocuments({ recipient: userId, isRead: false });
  }

  /**
   * Returns a paginated list of notifications for a user with category/priority/status filters.
   */
  async getUserNotifications(userId, {
    category,
    priority,
    isRead,
    page = 1,
    limit = 20,
  } = {}) {
    const filter = { recipient: userId };

    if (category && category !== 'all') {
      filter.category = category;
    }
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }
    if (typeof isRead === 'boolean') {
      filter.isRead = isRead;
    } else if (isRead === 'true' || isRead === 'false') {
      filter.isRead = isRead === 'true';
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
      this.getUnreadCount(userId),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * Marks a single notification as read by its recipient.
   */
  async markAsRead(userId, notificationId) {
    const notif = await Notification.findOne({ _id: notificationId, recipient: userId });
    if (!notif) return null;

    if (!notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      await notif.save();

      const unreadCount = await this.getUnreadCount(userId);
      this.emitRealtimeEvent(userId, 'unread_count', { unreadCount });
    }

    return notif;
  }

  /**
   * Marks all eligible notifications as read for a recipient.
   */
  async markAllAsRead(userId, { category } = {}) {
    const filter = { recipient: userId, isRead: false };
    if (category && category !== 'all') {
      filter.category = category;
    }

    const result = await Notification.updateMany(filter, {
      $set: { isRead: true, readAt: new Date() },
    });

    const unreadCount = await this.getUnreadCount(userId);
    this.emitRealtimeEvent(userId, 'unread_count', { unreadCount });

    return { modifiedCount: result.modifiedCount, unreadCount };
  }

  /**
   * Marks a single notification as unread.
   */
  async markAsUnread(userId, notificationId) {
    const notif = await Notification.findOne({ _id: notificationId, recipient: userId });
    if (!notif) return null;

    if (notif.isRead) {
      notif.isRead = false;
      notif.readAt = null;
      await notif.save();

      const unreadCount = await this.getUnreadCount(userId);
      this.emitRealtimeEvent(userId, 'unread_count', { unreadCount });
    }

    return notif;
  }

  /**
   * Deletes a notification strictly owned by the authenticated recipient.
   */
  async deleteNotification(userId, notificationId) {
    const result = await Notification.deleteOne({ _id: notificationId, recipient: userId });
    if (result.deletedCount > 0) {
      const unreadCount = await this.getUnreadCount(userId);
      this.emitRealtimeEvent(userId, 'unread_count', { unreadCount });
      return true;
    }
    return false;
  }
}

// Export singleton instance
module.exports = new NotificationService();

