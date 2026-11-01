/**
 * server/routes/assignment.routes.js
 * Endpoints for assignments, student submissions, evaluation, and downloads.
 */
'use strict';

const express = require('express');
const router = express.Router();

const {
  createAssignment,
  getFacultyAssignments,
  getFacultyAssignmentDashboard,
  getFacultyTaughtSubjects,
  getAssignmentById,
  updateAssignment,
  publishAssignment,
  closeAssignment,
  getAssignmentSubmissions,
  evaluateSubmission,
  publishSubmissionResult,
  getStudentAssignments,
  getStudentAssignmentDetails,
  submitAssignment,
  downloadAssignmentAttachment,
  downloadSubmissionFile,
  getAdminAssignmentOverview,
} = require('../controllers/assignment.controller');

const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { uploadAttachment, uploadSubmission } = require('../services/assignmentStorage.service');

// All assignment routes require authentication
router.use(authMiddleware);

// ── ADMIN ROUTES ─────────────────────────────────────────────────────────────
router.get('/admin/overview', allowRoles('admin'), getAdminAssignmentOverview);

// ── FACULTY SPECIFIC ROUTES ──────────────────────────────────────────────────
router.get('/faculty/dashboard', allowRoles('faculty', 'admin'), getFacultyAssignmentDashboard);
router.get('/faculty/subjects', allowRoles('faculty', 'admin'), getFacultyTaughtSubjects);
router.get('/faculty', allowRoles('faculty', 'admin'), getFacultyAssignments);

// ── STUDENT SPECIFIC ROUTES ──────────────────────────────────────────────────
router.get('/student', allowRoles('student'), getStudentAssignments);
router.get('/student/:id', allowRoles('student'), getStudentAssignmentDetails);
router.post(
  '/:id/submit',
  allowRoles('student'),
  uploadSubmission.array('files', 5),
  submitAssignment
);

// ── ATTACHMENT & SUBMISSION FILE DOWNLOADS ────────────────────────────────────
router.get('/:assignmentId/attachments/:attachmentId', downloadAssignmentAttachment);
router.get('/submissions/:submissionId/files/:fileId', downloadSubmissionFile);

// ── SUBMISSION EVALUATION (MOUNTED UNDER /api/assignments) ───────────────────
router.get('/:id/submissions', allowRoles('faculty', 'admin'), getAssignmentSubmissions);
router.post('/submissions/:id/evaluate', allowRoles('faculty', 'admin'), evaluateSubmission);
router.post('/submissions/:id/publish-result', allowRoles('faculty', 'admin'), publishSubmissionResult);

// ── GENERAL ASSIGNMENT CRUD & LIFECYCLE ───────────────────────────────────────
router.post(
  '/',
  allowRoles('faculty', 'admin'),
  uploadAttachment.array('attachments', 5),
  createAssignment
);
router.get('/:id', allowRoles('faculty', 'admin'), getAssignmentById);
router.patch('/:id', allowRoles('faculty', 'admin'), updateAssignment);
router.post('/:id/publish', allowRoles('faculty', 'admin'), publishAssignment);
router.post('/:id/close', allowRoles('faculty', 'admin'), closeAssignment);

module.exports = router;
