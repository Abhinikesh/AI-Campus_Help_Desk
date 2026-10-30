/**
 * server/routes/admin.routes.js
 */
'use strict';

const express = require('express');
const router = express.Router();
const {
  getStats,
  getAllUsers,
  deactivateUser,
  activateUser,
  getAllComplaints,
  updateComplaintStatus,
  createAnnouncement,
  getAllAnnouncements,
  // Smart Attendance
  getAttendanceOverview,
  getAdminAttendanceSessions,
  getAdminAttendanceRecords,
  getFaceEnrollments,
  deleteFaceEnrollment,
  getAttendanceAnalytics,
  getAttendanceSettings,
  updateAttendanceSettings,
} = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All admin routes require auth + admin role
router.use(authMiddleware, allowRoles('admin'));

router.get('/stats',                          getStats);
router.get('/users',                          getAllUsers);
router.patch('/users/:id/deactivate',         deactivateUser);
router.patch('/users/:id/activate',           activateUser);
router.get('/complaints',                     getAllComplaints);
router.patch('/complaints/:id/status',        updateComplaintStatus);
router.post('/announcements',                 createAnnouncement);
router.get('/announcements',                  getAllAnnouncements);

// Smart Attendance
router.get('/attendance/overview',            getAttendanceOverview);
router.get('/attendance/sessions',            getAdminAttendanceSessions);
router.get('/attendance/records',             getAdminAttendanceRecords);
router.get('/attendance/face-enrollments',    getFaceEnrollments);
router.delete('/attendance/face-enrollments/:studentId', deleteFaceEnrollment);
router.get('/attendance/analytics',           getAttendanceAnalytics);
router.get('/attendance/settings',            getAttendanceSettings);
router.put('/attendance/settings',            updateAttendanceSettings);

module.exports = router;
