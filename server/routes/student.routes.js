/**
 * server/routes/student.routes.js
 */
'use strict';

const express = require('express');
const router = express.Router();
const {
  getProfile,
  getAnnouncements,
  raiseComplaint,
  getMyComplaints,
  getFees,
  getAttendance,
  getAttendanceHistory,
  getActiveSessions,
  joinAttendanceSession,
  getFaceStatus,
  enrollFace,
  revokeFace,
  getExams,
  getResults,
} = require('../controllers/student.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All student routes require auth + student role
router.use(authMiddleware, allowRoles('student'));

router.get('/profile',              getProfile);
router.get('/announcements',        getAnnouncements);
router.post('/complaints',          raiseComplaint);
router.get('/complaints',           getMyComplaints);
router.get('/fees',                 getFees);

// Smart Attendance
router.get('/attendance',           getAttendance);
router.get('/attendance/history',   getAttendanceHistory);
router.get('/attendance/sessions',  getActiveSessions);
router.post('/attendance/join/:sessionId', joinAttendanceSession);

// Face Biometric Enrollment
router.get('/face/status',          getFaceStatus);
router.post('/face/enroll',         enrollFace);
router.post('/face/revoke',         revokeFace);

// Exams & Results
router.get('/exams',                getExams);
router.get('/results',              getResults);

module.exports = router;
