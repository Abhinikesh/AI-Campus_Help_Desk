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
  raiseComplaint,
} = require('../controllers/faculty.controller');
const { getQrChallenge } = require('../controllers/attendance.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All faculty routes require auth + faculty role
router.use(authMiddleware, allowRoles('faculty'));

router.get('/profile',              getProfile);
router.get('/overview',             getOverview);
router.get('/timetable',            getTimetable);
router.post('/announcements',       createAnnouncement);
router.get('/announcements',        getAnnouncements);
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
