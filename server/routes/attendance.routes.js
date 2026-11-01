/**
 * server/routes/attendance.routes.js
 * Comprehensive REST API routing for Smart Attendance.
 */
'use strict';

const express = require('express');
const router = express.Router();

const {
  createSession,
  getActiveSessions,
  getSessions,
  getSessionById,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  finalizeSession,
  cancelSession,
  getQrChallenge,
  getStudentOverview,
  getStudentHistory,
  joinSession,
  recordStudentAttendance,
  getStudentAttendanceRecord,
  getFacultyOverview,
  getFacultyClasses,
  getFacultySubjects,
  getFacultyRecords,
  getSessionStudents,
  correctAttendanceRecord,
  getFacultyReports,
  getAdminOverview,
  getAdminAuditLogs,
  getAdminFaceProfiles,
  deleteAdminFaceProfile,
  getAdminSettings,
  updateAdminSettings
} = require('../controllers/attendance.controller');

const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// ── 1. Attendance Session APIs ────────────────────────────────────────────────
router.post('/sessions',                      authMiddleware, allowRoles('faculty', 'admin'), createSession);
router.get('/sessions/active',                authMiddleware, getActiveSessions);
router.get('/sessions',                       authMiddleware, allowRoles('faculty', 'admin'), getSessions);
router.get('/sessions/:sessionId',            authMiddleware, getSessionById);
router.post('/sessions/:sessionId/start',     authMiddleware, allowRoles('faculty', 'admin'), startSession);
router.post('/sessions/:sessionId/pause',     authMiddleware, allowRoles('faculty', 'admin'), pauseSession);
router.post('/sessions/:sessionId/resume',    authMiddleware, allowRoles('faculty', 'admin'), resumeSession);
router.post('/sessions/:sessionId/end',       authMiddleware, allowRoles('faculty', 'admin'), endSession);
router.post('/sessions/:sessionId/finalize',  authMiddleware, allowRoles('faculty', 'admin'), finalizeSession);
router.post('/sessions/:sessionId/cancel',    authMiddleware, allowRoles('faculty', 'admin'), cancelSession);
router.get('/sessions/:sessionId/qr-challenge', authMiddleware, allowRoles('faculty', 'admin'), getQrChallenge);

// ── 2. Student Attendance APIs ────────────────────────────────────────────────
router.get('/student/overview',               authMiddleware, allowRoles('student'), getStudentOverview);
router.get('/student/history',                authMiddleware, allowRoles('student'), getStudentHistory);
router.get('/student/active-sessions',        authMiddleware, allowRoles('student'), getActiveSessions);
router.post('/student/:sessionId/join',       authMiddleware, allowRoles('student'), joinSession);
router.post('/student/:sessionId/attendance', authMiddleware, allowRoles('student'), recordStudentAttendance);
router.get('/student/:attendanceId',          authMiddleware, allowRoles('student'), getStudentAttendanceRecord);

// ── 3. Faculty Attendance APIs ────────────────────────────────────────────────
router.get('/faculty/overview',               authMiddleware, allowRoles('faculty'), getFacultyOverview);
router.get('/faculty/classes',                authMiddleware, allowRoles('faculty'), getFacultyClasses);
router.get('/faculty/subjects',               authMiddleware, allowRoles('faculty'), getFacultySubjects);
router.get('/faculty/records',                authMiddleware, allowRoles('faculty', 'admin'), getFacultyRecords);
router.get('/faculty/sessions/:sessionId/students', authMiddleware, allowRoles('faculty', 'admin'), getSessionStudents);
router.patch('/faculty/records/:attendanceId',authMiddleware, allowRoles('faculty', 'admin'), correctAttendanceRecord);
router.get('/faculty/reports',                authMiddleware, allowRoles('faculty', 'admin'), getFacultyReports);

// ── 4. Admin Attendance APIs ──────────────────────────────────────────────────
router.get('/admin/overview',                 authMiddleware, allowRoles('admin'), getAdminOverview);
router.get('/admin/sessions',                 authMiddleware, allowRoles('admin'), getSessions);
router.get('/admin/records',                  authMiddleware, allowRoles('admin'), getFacultyRecords);
router.get('/admin/audit-logs',               authMiddleware, allowRoles('admin'), getAdminAuditLogs);
router.get('/admin/face-profiles',            authMiddleware, allowRoles('admin'), getAdminFaceProfiles);
router.delete('/admin/face-profiles/:studentId', authMiddleware, allowRoles('admin'), deleteAdminFaceProfile);
router.get('/admin/settings',                 authMiddleware, allowRoles('admin'), getAdminSettings);
router.put('/admin/settings',                 authMiddleware, allowRoles('admin'), updateAdminSettings);

module.exports = router;
