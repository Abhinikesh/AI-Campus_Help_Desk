/**
 * server/routes/student.routes.js
 */
'use strict';

const express = require('express');
const router = express.Router();
const {
  getProfile,
  getProfileById,
  rejectStudentProfileEdit,
  getAnnouncements,
  raiseComplaint,
  getMyComplaints,
  getComplaintById,
  getFees,
  getFeeById,
  getAttendance,
  getAttendanceHistory,
  getAttendanceRecordById,
  getActiveSessions,
  joinAttendanceSession,
  getFaceStatus,
  grantConsent,
  enrollFace,
  requestReEnrollment,
  revokeFace,
  getExams,
  getResults,
  getResultById,
} = require('../controllers/student.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All student routes require auth + student role
router.use(authMiddleware, allowRoles('student'));

router.get('/profile',              getProfile);
router.get('/profile/:id',          getProfileById);
router.patch('/profile/:id',        rejectStudentProfileEdit);
router.patch('/profile',            rejectStudentProfileEdit);
router.put('/profile/:id',          rejectStudentProfileEdit);
router.put('/profile',              rejectStudentProfileEdit);

router.get('/announcements',        getAnnouncements);
router.post('/complaints',          raiseComplaint);
router.get('/complaints',           getMyComplaints);
router.get('/complaints/:id',       getComplaintById);
router.get('/fees',                 getFees);
router.get('/fees/:id',             getFeeById);

// Smart Attendance
router.get('/attendance',           getAttendance);
router.get('/attendance/history',   getAttendanceHistory);
router.get('/attendance/sessions',  getActiveSessions);
router.get('/attendance/:id',       getAttendanceRecordById);
router.post('/attendance/join/:sessionId', joinAttendanceSession);

// Face Biometric Enrollment
router.get('/face/status',          getFaceStatus);
router.post('/face/consent',         grantConsent);
router.post('/face/enroll',         enrollFace);
router.post('/face/re-enroll',      requestReEnrollment);
router.post('/face/revoke',         revokeFace);

// Exams & Results
router.get('/exams',                getExams);
router.get('/results',              getResults);
router.get('/results/:id',          getResultById);

// Timetable & Academic Calendar
const { getStudentTimetable } = require('../controllers/timetable.controller');
const { getCalendarEvents, getUpcomingEvents } = require('../controllers/calendar.controller');

router.get('/timetable',            getStudentTimetable);
router.get('/timetable/:id',        getStudentTimetable);
router.get('/calendar',             getCalendarEvents);
router.get('/calendar/upcoming',    getUpcomingEvents);

module.exports = router;
