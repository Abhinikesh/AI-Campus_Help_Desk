/**
 * server/routes/placement.routes.js
 * Express router for CampusSphere AI Placement & Career Development Subsystem.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { uploadResume, uploadOfferDoc } = require('../services/placement.service');

const {
  getCompanies,
  createCompany,
  getCompanyById,
  updateCompany,
  getMyProfile,
  updateMyProfile,
  uploadResume: uploadResumeController,
  downloadResume,
  getStudentProfileById,
  getOpportunities,
  createOpportunity,
  getOpportunityById,
  updateOpportunity,
  publishOpportunity,
  getDrives,
  createDrive,
  getDriveById,
  updateDrive,
  applyForOpportunity,
  getMyApplications,
  getDriveApplications,
  withdrawApplication,
  updateApplicationStatus,
  createSelectionStage,
  updateStageResult,
  correctStageResult,
  getMyInterviewSchedule,
  issueOffer,
  uploadOfferLetter,
  downloadOfferLetter,
  respondToOffer,
  verifyPlacement,
  getMyOffers,
  getAllOffers,
  getCareerResources,
  createCareerResource,
  getMetrics,
  exportReport,
} = require('../controllers/placement.controller');

// All placement endpoints require authentication
router.use(authMiddleware);

// ── 1. Student Placement Profile & Resumes ────────────────────────────────────
router.get('/profile/my', allowRoles('student'), getMyProfile);
router.put('/profile/my', allowRoles('student'), updateMyProfile);
router.post('/profile/resume', allowRoles('student'), uploadResume.single('resume'), uploadResumeController);
router.get('/resumes/:filename', downloadResume);
router.get('/students/:id/profile', allowRoles('admin', 'placement_officer', 'placement_coordinator', 'student'), getStudentProfileById);

// ── 2. Company Master Directory ──────────────────────────────────────────────
router.get('/companies', getCompanies);
router.post('/companies', allowRoles('admin', 'placement_officer'), createCompany);
router.get('/companies/:id', getCompanyById);
router.put('/companies/:id', allowRoles('admin', 'placement_officer'), updateCompany);

// ── 3. Career Opportunities & Eligibility ────────────────────────────────────
router.get('/opportunities', getOpportunities);
router.post('/opportunities', allowRoles('admin', 'placement_officer'), createOpportunity);
router.get('/opportunities/:id', getOpportunityById);
router.put('/opportunities/:id', allowRoles('admin', 'placement_officer'), updateOpportunity);
router.post('/opportunities/:id/publish', allowRoles('admin', 'placement_officer'), publishOpportunity);

// ── 4. Placement Recruitment Drives ──────────────────────────────────────────
router.get('/drives', getDrives);
router.post('/drives', allowRoles('admin', 'placement_officer'), createDrive);
router.get('/drives/:id', getDriveById);
router.put('/drives/:id', allowRoles('admin', 'placement_officer', 'placement_coordinator'), updateDrive);

// ── 5. Student Applications ──────────────────────────────────────────────────
router.post('/applications', allowRoles('student'), applyForOpportunity);
router.get('/applications/my', allowRoles('student'), getMyApplications);
router.get('/applications', allowRoles('admin', 'placement_officer', 'placement_coordinator'), getDriveApplications);
router.post('/applications/:id/withdraw', allowRoles('student', 'admin', 'placement_officer'), withdrawApplication);
router.patch('/applications/:id/status', allowRoles('admin', 'placement_officer', 'placement_coordinator'), updateApplicationStatus);

// ── 6. Selection Stages & Interviews ─────────────────────────────────────────
router.post('/stages', allowRoles('admin', 'placement_officer', 'placement_coordinator'), createSelectionStage);
router.post('/stages/result', allowRoles('admin', 'placement_officer', 'placement_coordinator'), updateStageResult);
router.patch('/stages/results/:id/correct', allowRoles('admin', 'placement_officer', 'placement_coordinator'), correctStageResult);
router.get('/interviews/my', allowRoles('student'), getMyInterviewSchedule);

// ── 7. Offer Management & Verification ───────────────────────────────────────
router.post('/offers', allowRoles('admin', 'placement_officer'), issueOffer);
router.post('/offers/:id/document', allowRoles('admin', 'placement_officer'), uploadOfferDoc.single('offerLetter'), uploadOfferLetter);
router.get('/offers/documents/:filename', downloadOfferLetter);
router.patch('/offers/:id/respond', allowRoles('student'), respondToOffer);
router.post('/offers/:id/verify', allowRoles('admin', 'placement_officer'), verifyPlacement);
router.get('/offers/my', allowRoles('student'), getMyOffers);
router.get('/offers', allowRoles('admin', 'placement_officer', 'placement_coordinator'), getAllOffers);

// ── 8. Career Development Resources ──────────────────────────────────────────
router.get('/resources', getCareerResources);
router.post('/resources', allowRoles('admin', 'placement_officer'), createCareerResource);

// ── 9. Analytics & Reporting ─────────────────────────────────────────────────
router.get('/metrics', allowRoles('admin', 'placement_officer', 'placement_coordinator'), getMetrics);
router.get('/export', allowRoles('admin', 'placement_officer', 'placement_coordinator'), exportReport);

module.exports = router;
