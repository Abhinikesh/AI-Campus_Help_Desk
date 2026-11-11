/**
 * server/routes/faculty.routes.js
 */
'use strict';

const express = require('express');
const router = express.Router();
const {
  getProfile,
  getOverview,
  getTimetable,
  createAttendanceSession,
  getAttendanceSessions,
  getSessionDetails,
  closeAttendanceSession,
  finalizeAttendanceSession,
  markAttendanceStudent,
  getAttendanceRecords,
  getAttendanceReports,
  markAttendance,
  createAnnouncement,
  getAnnouncements,
  getStudents,
  searchStudents,
  getStudent360,
  raiseComplaint,
  safeAuditLog,
} = require('../controllers/faculty.controller');
const { getQrChallenge } = require('../controllers/attendance.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

/**
 * Bounded in-memory sliding window limiter to prevent audit-log write amplification
 * from repeated unauthenticated scanning or brute-force requests (Phase 2.4 Hardening).
 * Capped at MAX_AUDIT_TRACKED_IPS to guarantee bounded memory usage (zero memory leaks).
 */
const MAX_AUDIT_TRACKED_IPS = 500;
const AUDIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_UNAUTH_AUDITS_PER_WINDOW = 10; // max 10 audit logs per IP per minute

const unauthAuditRateMap = new Map();

const shouldRecordUnauthAudit = (ip) => {
  const clientIp = ip || 'unknown';
  const now = Date.now();

  // Periodic cleanup of expired entries
  if (unauthAuditRateMap.size > 0 && Math.random() < 0.05) {
    for (const [key, record] of unauthAuditRateMap.entries()) {
      if (now > record.resetTime) {
        unauthAuditRateMap.delete(key);
      }
    }
  }

  let record = unauthAuditRateMap.get(clientIp);
  if (!record || now > record.resetTime) {
    // Evict oldest if map exceeds cap
    if (unauthAuditRateMap.size >= MAX_AUDIT_TRACKED_IPS) {
      const oldestKey = unauthAuditRateMap.keys().next().value;
      unauthAuditRateMap.delete(oldestKey);
    }
    record = { count: 1, resetTime: now + AUDIT_WINDOW_MS };
    unauthAuditRateMap.set(clientIp, record);
    return { record: true, isCapped: false };
  }

  record.count += 1;
  if (record.count <= MAX_UNAUTH_AUDITS_PER_WINDOW) {
    return { record: true, isCapped: false };
  }

  // Once threshold is reached, log exactly one notice indicating threshold reached, then suppress
  if (record.count === MAX_UNAUTH_AUDITS_PER_WINDOW + 1) {
    return { record: true, isCapped: true };
  }

  return { record: false, isCapped: true };
};

/**
 * Hardened audit middleware for unauthenticated requests (Phase 2.4).
 * Replaces response method interception with standard Express response 'finish' listener.
 * Generates distinct audit events for student search vs Student 360:
 * - FACULTY_STUDENT_SEARCH_UNAUTHENTICATED
 * - STUDENT_360_UNAUTHENTICATED
 * Safe, non-blocking, non-monkey-patching, and protected against write amplification.
 */
const auditUnauthenticatedFacultyAccess = (req, res, next) => {
  const path = req.originalUrl || req.path || '';
  const isSearchTarget = path.includes('/students/search');
  const is360Target = path.includes('/students') && path.includes('/360');

  if (!isSearchTarget && !is360Target) {
    return next();
  }

  // Extract student entityId if present in path (e.g. /students/:id/360)
  const idMatch = path.match(/\/students\/([a-fA-F0-9]{24})\/360/);
  const potentialEntityId = idMatch ? idMatch[1] : null;

  // Use standard Express 'finish' lifecycle listener instead of intercepting methods
  res.on('finish', () => {
    if (res.statusCode === 401) {
      const clientIp = req.ip || req.connection?.remoteAddress || '';
      const { record: shouldLog, isCapped } = shouldRecordUnauthAudit(clientIp);
      if (!shouldLog) return;

      const action = isSearchTarget
        ? 'FACULTY_STUDENT_SEARCH_UNAUTHENTICATED'
        : 'STUDENT_360_UNAUTHENTICATED';

      const baseSummary = isSearchTarget
        ? 'Unauthenticated access attempt on faculty student search endpoint'
        : 'Unauthenticated access attempt on Student 360 endpoint';

      const summary = isCapped
        ? `${baseSummary} (amplification threshold reached; throttling audit writes)`
        : baseSummary;

      safeAuditLog({
        actor: null,
        action,
        entityType: 'Student',
        entityId: isSearchTarget ? null : potentialEntityId,
        summary,
        ip: clientIp,
      });
    }
  });

  next();
};

// All faculty routes require auth + faculty role
router.use(auditUnauthenticatedFacultyAccess, authMiddleware, allowRoles('faculty'));

router.get('/profile',              getProfile);
router.get('/overview',             getOverview);
router.get('/timetable',            getTimetable);
router.post('/announcements',       createAnnouncement);
router.get('/announcements',        getAnnouncements);
router.get('/students/search',       searchStudents);
router.get('/students/:id/360',      getStudent360);
router.get('/students',             getStudents);
router.post('/complaints',          raiseComplaint);

// Smart Attendance
router.post('/attendance/sessions', createAttendanceSession);
router.get('/attendance/sessions',  getAttendanceSessions);
router.get('/attendance/sessions/:id', getSessionDetails);
router.get('/attendance/sessions/:sessionId/qr-challenge', getQrChallenge);
router.patch('/attendance/sessions/:id/close', closeAttendanceSession);
router.patch('/attendance/sessions/:id/finalize', finalizeAttendanceSession);
router.post('/attendance/mark-student', markAttendanceStudent);
router.get('/attendance/records',   getAttendanceRecords);
router.get('/attendance/reports',   getAttendanceReports);
router.post('/attendance',          markAttendance); // modal fallback

module.exports = router;
