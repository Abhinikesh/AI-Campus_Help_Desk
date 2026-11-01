/**
 * server/routes/hostel.routes.js
 * Express router for CampusSphere AI Hostel Management System.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const {
  createHostel,
  getHostels,
  getHostelById,
  updateHostel,
  archiveHostel,
  createRoom,
  getRooms,
  createBed,
  getBeds,
  createApplication,
  getApplications,
  reviewApplication,
  allocateBed,
  getAllocations,
  checkInStudent,
  checkOutStudent,
  requestTransfer,
  getTransferRequests,
  reviewTransfer,
  createHostelComplaint,
  getHostelComplaints,
  updateHostelComplaint,
  getMessMenu,
  updateMessMenu,
  getHostelPolicy,
  updateHostelPolicy,
  getStudentHostelOverview,
  getHostelMetrics,
  exportHostelCsv,
} = require('../controllers/hostel.controller');

// All hostel routes require authentication
router.use(authMiddleware);

// ── 1. Student Portal Overview ───────────────────────────────────────────────
router.get('/student/overview', allowRoles('student'), getStudentHostelOverview);

// ── 2. Admin & Warden Metrics and CSV Exports ────────────────────────────────
router.get('/admin/metrics', allowRoles('admin', 'warden'), getHostelMetrics);
router.get('/reports/export', allowRoles('admin', 'warden'), exportHostelCsv);

// ── 3. Policy Settings ───────────────────────────────────────────────────────
router.get('/policy', allowRoles('admin', 'warden', 'student'), getHostelPolicy);
router.patch('/policy', allowRoles('admin'), updateHostelPolicy);

// ── 4. Hostels Management ────────────────────────────────────────────────────
router.post('/hostels', allowRoles('admin'), createHostel);
router.get('/hostels', allowRoles('admin', 'warden', 'student', 'faculty'), getHostels);
router.get('/hostels/:id', allowRoles('admin', 'warden', 'student', 'faculty'), getHostelById);
router.patch('/hostels/:id', allowRoles('admin'), updateHostel);
router.delete('/hostels/:id', allowRoles('admin'), archiveHostel);

// ── 5. Room & Bed Inventory ──────────────────────────────────────────────────
router.post('/rooms', allowRoles('admin', 'warden'), createRoom);
router.get('/rooms', allowRoles('admin', 'warden', 'student', 'faculty'), getRooms);
router.post('/beds', allowRoles('admin', 'warden'), createBed);
router.get('/beds', allowRoles('admin', 'warden', 'student', 'faculty'), getBeds);

// ── 6. Student Applications ──────────────────────────────────────────────────
router.post('/applications', allowRoles('student'), createApplication);
router.get('/applications', allowRoles('admin', 'warden', 'student'), getApplications);
router.patch('/applications/:id/review', allowRoles('admin', 'warden'), reviewApplication);

// ── 7. Allocations & Circulation Desk (Check-in/Check-out) ───────────────────
router.post('/allocations', allowRoles('admin', 'warden'), allocateBed);
router.get('/allocations', allowRoles('admin', 'warden', 'student'), getAllocations);
router.post('/allocations/:id/check-in', allowRoles('admin', 'warden'), checkInStudent);
router.post('/allocations/:id/check-out', allowRoles('admin', 'warden'), checkOutStudent);

// ── 8. Room Transfers ────────────────────────────────────────────────────────
router.post('/transfers', allowRoles('student'), requestTransfer);
router.get('/transfers', allowRoles('admin', 'warden', 'student'), getTransferRequests);
router.patch('/transfers/:id/review', allowRoles('admin', 'warden'), reviewTransfer);

// ── 9. Hostel Maintenance & Grievances ───────────────────────────────────────
router.post('/complaints', allowRoles('student'), createHostelComplaint);
router.get('/complaints', allowRoles('admin', 'warden', 'student'), getHostelComplaints);
router.patch('/complaints/:id', allowRoles('admin', 'warden'), updateHostelComplaint);

// ── 10. Mess Dining Schedule ─────────────────────────────────────────────────
router.get('/mess-menu', allowRoles('admin', 'warden', 'student', 'faculty'), getMessMenu);
router.put('/mess-menu', allowRoles('admin', 'warden'), updateMessMenu);

module.exports = router;

