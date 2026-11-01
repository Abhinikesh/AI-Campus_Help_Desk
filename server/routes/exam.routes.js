/**
 * server/routes/exam.routes.js
 * Endpoints for examination scheduling, marks entry, review, approval & publication.
 */
'use strict';

const express = require('express');
const router = express.Router();

const {
  createExam,
  getFacultyExams,
  getExamById,
  updateExam,
  cancelExam,
  getExamRoster,
  saveDraftMarks,
  submitMarksForReview,
  reviewAndApproveMarks,
  publishExamResults,
  requestMarksCorrection,
  correctPublishedMark,
  getStudentExamSchedule,
  getStudentResults,
  getAdminExamsOverview,
} = require('../controllers/exam.controller');

const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All exam routes require authentication
router.use(authMiddleware);

// ── STUDENT ENDPOINTS ────────────────────────────────────────────────────────
router.get('/student/schedule', allowRoles('student'), getStudentExamSchedule);
router.get('/student/results', allowRoles('student'), getStudentResults);

// ── ADMIN OVERSIGHT ──────────────────────────────────────────────────────────
router.get('/admin/overview', allowRoles('admin'), getAdminExamsOverview);

// ── FACULTY SPECIFIC ROUTES ──────────────────────────────────────────────────
router.get('/faculty', allowRoles('faculty', 'admin'), getFacultyExams);

// ── MARKS CORRECTION ─────────────────────────────────────────────────────────
router.post('/marks/:markId/correct', allowRoles('faculty', 'admin'), correctPublishedMark);

// ── GENERAL EXAMINATION LIFECYCLE ───────────────────────────────────────────
router.post('/', allowRoles('faculty', 'admin'), createExam);
router.get('/:id', getExamById);
router.patch('/:id', allowRoles('faculty', 'admin'), updateExam);
router.post('/:id/cancel', allowRoles('faculty', 'admin'), cancelExam);
router.get('/:id/roster', allowRoles('faculty', 'admin'), getExamRoster);

// ── MARKS ENTRY & EVALUATION ─────────────────────────────────────────────────
router.post('/:id/marks/draft', allowRoles('faculty', 'admin'), saveDraftMarks);
router.post('/:id/marks/submit', allowRoles('faculty', 'admin'), submitMarksForReview);
router.post('/:id/marks/approve', allowRoles('faculty', 'admin'), reviewAndApproveMarks);
router.post('/:id/results/publish', allowRoles('faculty', 'admin'), publishExamResults);
router.post('/:id/marks/request-correction', allowRoles('admin'), requestMarksCorrection);

module.exports = router;
