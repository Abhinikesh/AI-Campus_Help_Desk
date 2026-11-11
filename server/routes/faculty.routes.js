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
 * Intercepts unauthenticated (401) requests targeted specifically at Student 360 endpoints (Fix Phase 2.3).
 * Logs a STUDENT_360_UNAUTHENTICATED audit event without logging passwords, tokens, cookies, or headers.
 * Does not alter the original 401 response or expose internal exceptions.
 */
const auditUnauthenticatedStudent360 = (req, res, next) => {
  const path = req.originalUrl || req.path || '';
  const isStudent360Target = path.includes('/students') && (path.includes('/360') || path.includes('/search'));

  if (!isStudent360Target) {
    return next();
  }

  // Extract student entityId if present in path (e.g. /students/:id/360)
  const idMatch = path.match(/\/students\/([a-fA-F0-9]{24})\/360/);
  const potentialEntityId = idMatch ? idMatch[1] : null;

  const originalStatus = res.status.bind(res);
  res.status = function (statusCode) {
    if (statusCode === 401) {
      safeAuditLog({
        actor: null,
        action: 'STUDENT_360_UNAUTHENTICATED',
        entityType: 'Student',
        entityId: potentialEntityId,
        summary: 'Unauthenticated access attempt on Student 360 endpoint',
        ip: req.ip || '',
      });
    }
    return originalStatus(statusCode);
  };

  next();
};

// All faculty routes require auth + faculty role
router.use(auditUnauthenticatedStudent360, authMiddleware, allowRoles('faculty'));

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
