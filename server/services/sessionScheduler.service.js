/**
 * server/services/sessionScheduler.service.js
 * Background service for reliable, automatic expiration of orphaned or overdue attendance sessions.
 * Features:
 * - Singleton lifecycle management (clean start and stop)
 * - Concurrency protection (atomic conditional updates prevent duplicate execution)
 * - Injectable clock for unit and integration testing
 * - Safe error handling and audit logging without secrets exposure
 */
'use strict';

const AttendanceSession = require('../models/AttendanceSession');
const AttendanceSettings = require('../models/AttendanceSettings');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');

class SessionSchedulerService {
  constructor() {
    this.timer = null;
    this.isExecuting = false;
    this.intervalMs = 60000; // 1 minute default interval
  }

  /**
   * Helper: Parse session deadline from date, endTime and grace period.
   * Falls back to openedAt + duration + grace if time string cannot be parsed.
   */
  calculateSessionDeadline(session, defaultDurationMinutes = 60, gracePeriodMinutes = 15) {
    // 1. Try parsing session.date + session.endTime (e.g. "2026-04-12" + "10:00 AM")
    if (session.date && session.endTime) {
      try {
        const timeParts = session.endTime.trim().match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeParts) {
          let hours = parseInt(timeParts[1], 10);
          const minutes = parseInt(timeParts[2], 10);
          const meridian = timeParts[3] ? timeParts[3].toUpperCase() : null;

          if (meridian === 'PM' && hours < 12) hours += 12;
          if (meridian === 'AM' && hours === 12) hours = 0;

          const isoString = `${session.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`;
          const dateObj = new Date(isoString);
          if (!isNaN(dateObj.getTime())) {
            dateObj.setUTCMinutes(dateObj.getUTCMinutes() + gracePeriodMinutes);
            return dateObj;
          }
        }
      } catch (e) {
        // Fall back to openedAt calculation
      }
    }

    // 2. Fallback: Base timestamp on openedAt or createdAt + defaultDuration + grace
    const baseTime = session.openedAt || session.actualStartTime || session.createdAt || new Date();
    const deadline = new Date(baseTime);
    const totalMinutes = defaultDurationMinutes + gracePeriodMinutes;
    deadline.setMinutes(deadline.getMinutes() + totalMinutes);
    return deadline;
  }

  /**
   * Core sweep: find and atomically expire sessions exceeding their scheduled duration + grace.
   *
   * @param {Date} [now=new Date()] Injectable clock for deterministic testing
   * @param {Object} [options={}] Optional overrides (e.g. maxDuration, gracePeriod)
   * @returns {Promise<{ checkedCount: number, expiredCount: number, expiredSessionIds: string[] }>}
   */
  async checkAndExpireSessions(now = new Date(), options = {}) {
    if (this.isExecuting) {
      return { checkedCount: 0, expiredCount: 0, expiredSessionIds: [], skipped: true };
    }

    this.isExecuting = true;
    const expiredSessionIds = [];

    try {
      // 1. Fetch system settings
      let settings = await AttendanceSettings.findOne().lean();
      const defaultDuration = options.defaultDurationMinutes || settings?.defaultSessionDurationMinutes || 60;
      const gracePeriod = options.lateGracePeriodMinutes || settings?.lateGracePeriodMinutes || 15;

      // 2. Find all sessions currently open, active, or paused
      const activeSessions = await AttendanceSession.find({
        status: { $in: ['open', 'active', 'paused'] }
      });

      for (const session of activeSessions) {
        const deadline = this.calculateSessionDeadline(session, defaultDuration, gracePeriod);

        if (now > deadline) {
          // 3. Conditional atomic update: ensures only one worker/process expires the session
          const updated = await AttendanceSession.findOneAndUpdate(
            { _id: session._id, status: session.status },
            {
              $set: {
                status: 'completed',
                sessionStatus: 'completed',
                closedAt: now,
                actualEndTime: now,
                autoExpired: true
              }
            },
            { new: true }
          );

          if (updated) {
            expiredSessionIds.push(updated._id.toString());

            // 4. Record audit event
            await AttendanceAuditLog.record({
              actorId: session.faculty || session._id,
              actorRole: 'system',
              action: 'auto_expire_session',
              sessionId: updated._id,
              previousValue: { status: session.status },
              newValue: { status: 'completed', autoExpired: true, closedAt: now },
              reason: `Session automatically closed after exceeding scheduled duration and ${gracePeriod}-minute grace period`
            });
          }
        }
      }

      return {
        checkedCount: activeSessions.length,
        expiredCount: expiredSessionIds.length,
        expiredSessionIds
      };
    } catch (err) {
      console.error('[SessionScheduler] Error during session expiration sweep:', err.message);
      return { checkedCount: 0, expiredCount: 0, expiredSessionIds: [], error: err.message };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Start recurring background scheduler.
   */
  startScheduler(intervalMs = 60000) {
    if (this.timer) {
      return; // Already started
    }

    this.intervalMs = intervalMs;
    this.timer = setInterval(() => {
      this.checkAndExpireSessions(new Date()).catch((err) => {
        console.error('[SessionScheduler] Uncaught scheduler iteration error:', err.message);
      });
    }, this.intervalMs);

    // Unref timer so it doesn't prevent Node process from gracefully exiting if needed
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop recurring background scheduler.
   */
  stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isExecuting = false;
  }
}

// Export singleton instance
const sessionSchedulerService = new SessionSchedulerService();
module.exports = sessionSchedulerService;
