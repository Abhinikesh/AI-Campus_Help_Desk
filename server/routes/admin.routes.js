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
  purgeBulkEnrollments,
  getAttendanceAnalytics,
  getAttendanceSettings,
  updateAttendanceSettings,
} = require('../controllers/admin.controller');

const {
  listStagingStudents,
  getStagingStats,
  getStagingStudentDetail,
  searchStagingStudents,
} = require('../controllers/stagingStudents.controller');

const {
  getVerificationStats,
  listVerifications,
  getVerificationDetail,
  getVerificationHistory,
  createPendingVerification,
  recordEvidence,
  approveVerification,
  rejectVerification,
  requestReview,
} = require('../controllers/enrollmentVerification.controller');

const {
  getPromotionStats,
  getPromotionPreview,
  promoteStudent,
  getPromotionHistory,
} = require('../controllers/studentPromotion.controller');

const {
  uploadRegisterFile,
  previewColumnMapping,
  executeImport,
  getImportList,
  getImportDetail,
  getImportRows,
  getRowDetail,
  reviewRowEvidence,
  deleteImport,
} = require('../controllers/enrollmentRegisterImport.controller');

const upload = require('../middleware/upload.middleware');

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
router.post('/attendance/face-enrollments/purge-bulk', purgeBulkEnrollments);
router.delete('/attendance/face-enrollments/:studentId', deleteFaceEnrollment);
router.get('/attendance/analytics',           getAttendanceAnalytics);
router.get('/attendance/settings',            getAttendanceSettings);
router.put('/attendance/settings',            updateAttendanceSettings);

// ── Phase 3.6: Staging Student Management (Read-Only) ──────────────────────
// All routes under /api/admin/staging/ are locked to admin role by the
// router-level middleware above and serve only BATCH-20261112-STAGING-003.
router.get('/staging/students/stats',         getStagingStats);
router.get('/staging/students/search',        searchStagingStudents);
router.get('/staging/students',               listStagingStudents);
router.get('/staging/students/:rollNumber',   getStagingStudentDetail);

// ── Phase 3.7: Enrollment Verification Workflow ──────────────────────────────
router.get('/staging/enrollment/stats',                    getVerificationStats);
router.get('/staging/enrollment',                          listVerifications);
router.get('/staging/enrollment/:rollNumber',              getVerificationDetail);
router.get('/staging/enrollment/:rollNumber/history',      getVerificationHistory);
router.post('/staging/enrollment',                         createPendingVerification);
router.patch('/staging/enrollment/:rollNumber/evidence',   recordEvidence);
router.patch('/staging/enrollment/:rollNumber/approve',    approveVerification);
router.patch('/staging/enrollment/:rollNumber/reject',     rejectVerification);
router.patch('/staging/enrollment/:rollNumber/review',     requestReview);

// ── Phase 3.8: Controlled Verified Student Promotion ────────────────────────
router.get('/staging/promotion/stats',                     getPromotionStats);
router.get('/staging/promotion/preview/:rollNumber',       getPromotionPreview);
router.post('/staging/promotion/:rollNumber',              promoteStudent);
router.get('/staging/promotion/history',                   getPromotionHistory);

// ── Phase 3.9A: Official Enrollment Register Import & Reconciliation ──────────
// multer upload middleware applied only to the file-upload endpoint.
router.post('/staging/register/upload',                      upload.single('file'), uploadRegisterFile);
router.post('/staging/register/preview/:importId',           previewColumnMapping);
router.post('/staging/register/import/:importId',            executeImport);
router.get('/staging/register/imports',                      getImportList);
router.get('/staging/register/imports/:importId',            getImportDetail);
router.get('/staging/register/imports/:importId/rows',       getImportRows);
router.get('/staging/register/rows/:rowId',                  getRowDetail);
router.patch('/staging/register/rows/:rowId/review',         reviewRowEvidence);
router.delete('/staging/register/imports/:importId',         deleteImport);

module.exports = router;
